import type { CueHit, NormalizedText } from "./types";

const SHORTENERS =
  /\b(?:bit\.ly|tinyurl\.com|t\.co|rb\.gy|cutt\.ly|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|shorturl\.at|tiny\.cc)\b/i;
const ODD_GIFTS = /\b(?:discord\.gift|steamcommunity\.com\.|free-?nitro|nitro-?free|free-?steam)\b/i;
const URL =
  /https?:\/\/[^\s<>]+|(?:www\.)[^\s<>]+|(?:bit\.ly|tinyurl\.com|discord\.gift)\/[^\s<>]+/gi;
const MONEY = /\$\s?\d[\d,]*(?:\.\d{2})?|\b\d+(?:\.\d{2})?\s?(?:usd|dollars?|btc|eth|usdt)\b/i;
const IMPERATIVE =
  /\b(?:send|wire|click|call|pay|purchase|buy|deposit|transfer|verify|confirm|download|open|submit|unlock)\b/i;
const WON = /\b(?:you(?:'ve| have)? won|winner|congratulations.{0,24}won|you are (?:a )?winner)\b/i;
const RELATION =
  /\b(?:thanks for (?:your )?(?:order|ticket|purchase)|as we discussed|your (?:order|package|subscription)|following up)\b/i;

export type StructuralFinding = {
  score: number;
  reasons: string[];
  highlights: { start: number; end: number; family: string }[];
};

export function structuralSignals(
  original: string,
  normalized: NormalizedText,
  hits: CueHit[],
): StructuralFinding {
  let score = 0;
  const reasons: string[] = [];
  const highlights: { start: number; end: number; family: string }[] = [];
  const text = normalized.text;
  const families = new Set(hits.map((h) => h.family));

  const urls = original.match(URL) || text.match(URL) || [];
  if (urls.length) {
    score += 4;
    if (SHORTENERS.test(original) || SHORTENERS.test(text)) {
      score += 8;
      reasons.push("Uses a shortened or disguised link.");
    }
    if (ODD_GIFTS.test(original) || ODD_GIFTS.test(text)) {
      score += 14;
      reasons.push("Link looks like a fake prize or login page.");
    }
    if (families.has("credential") || families.has("action")) {
      score += 8;
    }
    if (families.has("reward")) {
      score += 6;
    }
  }

  if (WON.test(text) && !RELATION.test(text)) {
    score += 10;
    reasons.push("Prize claim with no real prior relationship.");
  }

  if (MONEY.test(original) && IMPERATIVE.test(text)) {
    score += 8;
    reasons.push("Money amount paired with an order to act.");
  }

  return { score, reasons, highlights };
}
