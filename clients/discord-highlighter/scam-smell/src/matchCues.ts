import type { Cue, CueHit, NormalizedText, Token } from "./types";
import { originalSpan } from "./normalize";

const NEGATION = new Set(["not", "n't", "never", "no", "without"]);

function toRegex(pattern: string): RegExp {
  const trimmed = pattern.trim();
  if (trimmed.startsWith("re:")) {
    return new RegExp(trimmed.slice(3), "i");
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  const startBound = /^[a-z0-9]/i.test(trimmed) ? "\\b" : "";
  const endBound = /[a-z0-9]$/i.test(trimmed) ? "\\b" : "";
  return new RegExp(`${startBound}${escaped}${endBound}`, "i");
}

function tokenIndexAt(tokens: Token[], start: number): number {
  let best = 0;
  for (const token of tokens) {
    if (token.start <= start) best = token.index;
    else break;
  }
  return best;
}

function isNegated(tokens: Token[], hitIndex: number): boolean {
  const from = Math.max(0, hitIndex - 3);
  for (let i = from; i < hitIndex; i += 1) {
    if (NEGATION.has(tokens[i].text.replace(/'/g, ""))) return true;
  }
  return false;
}

export function matchCues(
  normalized: NormalizedText,
  tokens: Token[],
  cues: Cue[],
): CueHit[] {
  const hits: CueHit[] = [];
  for (const cue of cues) {
    for (const pattern of cue.patterns) {
      const re = toRegex(pattern);
      const hay = normalized.text;
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      const global = new RegExp(re.source, "gi");
      while ((match = global.exec(hay))) {
        const start = match.index;
        const end = start + match[0].length;
        const tokenIndex = tokenIndexAt(tokens, start);
        if (!cue.negation_safe && isNegated(tokens, tokenIndex)) continue;
        const span = originalSpan(normalized, start, end);
        hits.push({
          cueId: cue.id,
          family: cue.family,
          weight: cue.weight,
          start: span.start,
          end: span.end,
          tokenIndex,
          negationSafe: Boolean(cue.negation_safe),
        });
        if (match[0].length === 0) global.lastIndex += 1;
      }
    }
  }
  return hits;
}

export function capRepeats(hits: CueHit[]): { hits: CueHit[]; raw: number } {
  const seen: Record<string, number> = {};
  let raw = 0;
  const kept: CueHit[] = [];
  for (const hit of hits) {
    const n = seen[hit.cueId] ?? 0;
    seen[hit.cueId] = n + 1;
    const factor = n === 0 ? 1 : n === 1 ? 0.4 : 0.12;
    raw += hit.weight * factor;
    kept.push(hit);
  }
  return { hits: kept, raw };
}
