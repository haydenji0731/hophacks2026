import type { NormalizedText, Token } from "./types";

const ZERO_WIDTH = /[\u200b\u200c\u200d\u2060\ufeff\u00ad]/g;
const LEET: Record<string, string> = {
  "@": "a",
  $: "s",
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
};

function decodeLeetChar(ch: string, tokenHasLetters: boolean): string {
  if (!tokenHasLetters) return ch;
  return LEET[ch] ?? ch;
}

function decodeLeet(raw: string): string {
  return raw.replace(/[A-Za-z0-9@$]+/g, (token) => {
    if (!/[A-Za-z]/.test(token)) return token;
    return token
      .split("")
      .map((ch) => decodeLeetChar(ch, true))
      .join("");
  });
}

export function normalize(original: string): NormalizedText {
  const map: number[] = [];
  let text = "";
  const stripped = original.replace(ZERO_WIDTH, "");
  for (let i = 0; i < stripped.length; i += 1) {
    const ch = stripped[i];
    if (/\s/.test(ch)) {
      if (text.endsWith(" ")) continue;
      text += " ";
      map.push(i);
      continue;
    }
    text += ch;
    map.push(i);
  }
  const folded = decodeLeet(text.toLowerCase());
  let out = "";
  const outMap: number[] = [];
  for (let i = 0; i < folded.length; i += 1) {
    const ch = folded[i];
    if (ch === " " && out.endsWith(" ")) continue;
    out += ch;
    outMap.push(map[i] ?? map[map.length - 1] ?? 0);
  }
  return { original, text: out.trim(), map: outMap };
}

export function tokenize(normalized: NormalizedText): Token[] {
  const tokens: Token[] = [];
  const re = /[a-z0-9]+(?:'[a-z]+)?/g;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = re.exec(normalized.text))) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
      index,
    });
    index += 1;
  }
  return tokens;
}

export function ngrams(tokens: Token[], n: number): { text: string; start: number; end: number }[] {
  const grams: { text: string; start: number; end: number }[] = [];
  for (let i = 0; i <= tokens.length - n; i += 1) {
    const slice = tokens.slice(i, i + n);
    grams.push({
      text: slice.map((t) => t.text).join(" "),
      start: slice[0].start,
      end: slice[slice.length - 1].end,
    });
  }
  return grams;
}

export function originalSpan(normalized: NormalizedText, start: number, end: number): {
  start: number;
  end: number;
} {
  const s = normalized.map[start] ?? 0;
  const e = normalized.map[Math.max(start, end - 1)] ?? s;
  return { start: s, end: e + 1 };
}
