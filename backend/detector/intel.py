"""TF-IDF vector index over scam-pattern TSV seeds (in-memory cosine search)."""

from __future__ import annotations

import csv
import math
import re
from collections import Counter
from functools import lru_cache
from pathlib import Path
from typing import Any

SEEDS = Path(__file__).resolve().parents[1] / "db" / "seeds"
_TOKEN = re.compile(r"[a-z0-9]+")
_ARRAY_ITEM = re.compile(r'"((?:[^"\\]|\\.)*)"|([^,\{\}]+)')


def display_name(slug: str) -> str:
    return slug.replace("_", " ").strip().title()


def _dot(left: list[float], right: list[float]) -> float:
    return sum(a * b for a, b in zip(left, right))


def _normalize(vec: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vec))
    if norm == 0:
        return vec
    return [value / norm for value in vec]


def parse_pg_text_array(raw: str | None) -> list[str]:
    if raw is None:
        return []
    text = raw.strip()
    if not text or text == "{}":
        return []
    if text.startswith("{") and text.endswith("}"):
        text = text[1:-1]
    if not text.strip():
        return []
    items: list[str] = []
    for match in _ARRAY_ITEM.finditer(text):
        quoted, bare = match.groups()
        value = quoted if quoted is not None else bare
        value = value.strip().strip('"')
        if value:
            items.append(value)
    return items


def _tokenize(text: str) -> list[str]:
    words = _TOKEN.findall((text or "").lower())
    grams: list[str] = []
    for word in words:
        grams.append(word)
        if len(word) >= 4:
            grams.extend(word[i : i + 3] for i in range(len(word) - 2))
    grams.extend(f"{a}_{b}" for a, b in zip(words, words[1:]))
    return grams


def _doc_text(row: dict[str, Any]) -> str:
    parts = [
        (row.get("name") or "").replace("_", " "),
        row.get("description") or "",
        " ".join(row.get("platforms") or []),
        " ".join(row.get("demands") or []),
        " ".join(row.get("victim_roles") or []),
    ]
    return " ".join(parts)


def _seed_files() -> list[Path]:
    merged = SEEDS / "scams_patterns_merged.tsv"
    if merged.is_file():
        return [merged]
    files = [
        SEEDS / "reddit_scam_patterns.062126_091926.tsv",
        SEEDS / "scams_patterns_multisource.091926.tsv",
    ]
    return [path for path in files if path.is_file()]


def _load_tsv_rows(path: Path) -> list[dict[str, str]]:
    delimiter = "," if path.suffix.lower() == ".csv" else "\t"
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle, delimiter=delimiter))


def _merge_row(existing: dict[str, Any], incoming: dict[str, Any]) -> None:
    existing["platforms"] = sorted(set(existing["platforms"] + incoming["platforms"]))
    existing["demands"] = sorted(set(existing["demands"] + incoming["demands"]))
    existing["victim_roles"] = sorted(set(existing["victim_roles"] + incoming["victim_roles"]))
    if incoming["frequency"] > existing["frequency"]:
        existing["frequency"] = incoming["frequency"]
        if incoming["description"]:
            existing["description"] = incoming["description"]
    elif incoming["description"] and len(incoming["description"]) > len(existing["description"]):
        existing["description"] = incoming["description"]


def load_pattern_rows() -> list[dict[str, Any]]:
    by_name: dict[str, dict[str, Any]] = {}
    for path in _seed_files():
        for raw in _load_tsv_rows(path):
            name = (raw.get("name") or "").strip()
            if not name:
                continue
            try:
                frequency = int(raw.get("frequency") or 0)
            except ValueError:
                frequency = 0
            row = {
                "id": name,
                "name": name,
                "title": display_name(name),
                "description": (raw.get("description") or "").strip(),
                "platforms": parse_pg_text_array(raw.get("platforms")),
                "demands": parse_pg_text_array(raw.get("demands")),
                "victim_roles": parse_pg_text_array(raw.get("victim_roles")),
                "frequency": frequency,
            }
            existing = by_name.get(name)
            if existing is None:
                by_name[name] = row
            else:
                _merge_row(existing, row)
    return sorted(by_name.values(), key=lambda r: (-r["frequency"], r["name"]))


class PatternIndex:
    def __init__(self, rows: list[dict[str, Any]] | None = None) -> None:
        self.rows = rows if rows is not None else load_pattern_rows()
        self._vocab: dict[str, int] = {}
        self._idf: list[float] = []
        self._matrix: list[list[float]] = []
        self._fit()

    def _fit(self) -> None:
        docs = [_tokenize(_doc_text(row)) for row in self.rows]
        df: Counter[str] = Counter()
        for tokens in docs:
            df.update(set(tokens))
        self._vocab = {term: i for i, term in enumerate(sorted(df))}
        n_docs = max(len(docs), 1)
        n_terms = len(self._vocab)
        self._idf = [0.0] * n_terms
        for term, idx in self._vocab.items():
            self._idf[idx] = math.log((n_docs + 1) / (df[term] + 1)) + 1.0
        self._matrix = []
        for tokens in docs:
            vec = [0.0] * n_terms
            counts = Counter(tokens)
            for term, count in counts.items():
                j = self._vocab.get(term)
                if j is None:
                    continue
                vec[j] = count * self._idf[j]
            self._matrix.append(_normalize(vec))

    def _vector(self, text: str) -> list[float]:
        n_terms = len(self._vocab)
        vec = [0.0] * n_terms
        counts = Counter(_tokenize(text))
        for term, count in counts.items():
            j = self._vocab.get(term)
            if j is None:
                continue
            vec[j] = count * self._idf[j]
        return _normalize(vec)

    def search(self, query: str, *, limit: int = 20) -> list[dict[str, Any]]:
        q = (query or "").strip()
        if not q:
            return [{**row, "score": 1.0} for row in self.rows[:limit]]
        vec = self._vector(q)
        if not self.rows or not any(vec):
            lowered = q.lower()
            hits = [
                {**row, "score": 0.15}
                for row in self.rows
                if lowered in row["name"].lower() or lowered in row["description"].lower()
            ]
            return hits[:limit]
        scored = [
            (i, _dot(row_vec, vec))
            for i, row_vec in enumerate(self._matrix)
        ]
        scored.sort(key=lambda item: item[1], reverse=True)
        out: list[dict[str, Any]] = []
        for idx, score in scored:
            if score <= 0.02:
                continue
            out.append({**self.rows[idx], "score": round(score, 4)})
            if len(out) >= limit:
                break
        return out

    def get(self, key: str) -> dict[str, Any] | None:
        needle = (key or "").strip().lower()
        for row in self.rows:
            if row["name"].lower() == needle or row["id"].lower() == needle:
                return row
        return None


@lru_cache(maxsize=1)
def get_index() -> PatternIndex:
    return PatternIndex()


def retrieve(text: str, *, k: int = 5) -> list[dict[str, Any]]:
    return get_index().search(text, limit=k)
