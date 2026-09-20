import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SCAM_TYPES } from "../data/questions.js";

const PAGE_SIZE = 3;
const SEARCH_SUGGESTIONS = [
  "marketplace refund",
  "WhatsApp romance",
  "job training fee",
];

function fallbackPatterns(query) {
  const q = query.trim().toLowerCase();
  const rows = SCAM_TYPES.map((scam) => ({
    id: scam.id,
    name: scam.id,
    title: scam.name,
    description: scam.summary,
    platforms: [],
    demands: [],
    frequency: 0,
    score: null,
  }));
  if (!q) return rows;
  return rows.filter(
    (row) =>
      row.title.toLowerCase().includes(q) ||
      row.description.toLowerCase().includes(q),
  );
}

export default function Repository() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [patterns, setPatterns] = useState([]);
  const [status, setStatus] = useState("loading");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setShown(PAGE_SIZE);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (debounced.trim()) params.set("q", debounced.trim());
    params.set("limit", "200");
    setStatus("loading");
    fetch(`/api/v1/intel?${params}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("intel");
        return res.json();
      })
      .then((data) => {
        setPatterns(data.patterns || []);
        setStatus("ready");
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setPatterns(fallbackPatterns(debounced));
        setStatus("offline");
      });
    return () => controller.abort();
  }, [debounced]);

  return (
    <section className="repo-head">
      <p className="eyebrow">Threat intel</p>
      <h1>Pattern Repository</h1>
      <p className="lede">
        These are the types of scams we&apos;ve identified, organized by their
        key traits. Search using keywords — it will pull up anything close.
      </p>

      <div className="search-wrap">
        <input
          className="search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 120)}
          placeholder="Search here"
          aria-label="Search scam patterns"
          aria-describedby="search-hints"
        />
        <p className="search-hints" id="search-hints" hidden={!searchFocused}>
          Try{" "}
          {SEARCH_SUGGESTIONS.map((hint, i) => (
            <span key={hint}>
              {i > 0 ? ", " : ""}
              <button
                type="button"
                className="search-hint"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(hint);
                  setSearchFocused(false);
                }}
              >
                {hint}
              </button>
            </span>
          ))}
          .
        </p>
      </div>
      <p className="muted intel-status">
        {status === "loading"
          ? "Searching catalog…"
          : status === "offline"
            ? "Detector offline — showing built-in types."
            : `${patterns.length} pattern${patterns.length === 1 ? "" : "s"}`}
      </p>

      <ul className="scam-list">
        {patterns.length === 0 && status !== "loading" ? (
          <li className="placeholder-card">No patterns match that search.</li>
        ) : (
          patterns.slice(0, shown).map((scam) => (
            <li key={scam.id || scam.name}>
              <Link className="scam-card" to={`/scams/${scam.id || scam.name}`}>
                <strong>{scam.title || scam.name}</strong>
                <p>{scam.description}</p>
                {(scam.platforms?.length > 0 || scam.frequency > 0) && (
                  <span className="scam-card-meta">
                    {scam.frequency > 0 ? `${scam.frequency} reports` : null}
                    {scam.frequency > 0 && scam.platforms?.length ? " · " : null}
                    {scam.platforms?.slice(0, 4).join(" · ")}
                  </span>
                )}
              </Link>
            </li>
          ))
        )}
      </ul>
      {shown < patterns.length ? (
        <button
          type="button"
          className="btn btn-secondary intel-more"
          onClick={() => setShown((n) => n + PAGE_SIZE)}
        >
          Load more
        </button>
      ) : null}
    </section>
  );
}
