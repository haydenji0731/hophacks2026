const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "from",
  "that",
  "this",
  "they",
  "them",
  "their",
  "was",
  "were",
  "been",
  "being",
  "have",
  "has",
  "had",
  "did",
  "does",
  "doing",
  "just",
  "about",
  "into",
  "then",
  "than",
  "your",
  "you",
  "me",
  "my",
  "i",
  "it",
  "is",
  "are",
  "be",
  "as",
  "at",
  "by",
  "if",
  "not",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

export function blob(scam: {
  slug: string;
  name: string;
  description: string;
  victimRoles: string[];
  aliases?: string[];
  catalogIds?: string[];
  seedDescription?: string;
  tags?: { channels?: string[]; hooks?: string[]; asks?: string[]; signals?: string[] };
}): string {
  const tags = scam.tags
    ? [...(scam.tags.channels ?? []), ...(scam.tags.hooks ?? []), ...(scam.tags.asks ?? []), ...(scam.tags.signals ?? [])]
    : [];
  return [
    scam.slug.replaceAll("_", " "),
    scam.name,
    scam.description,
    scam.seedDescription ?? "",
    (scam.victimRoles ?? []).join(" "),
    (scam.aliases ?? []).join(" "),
    (scam.catalogIds ?? []).join(" "),
    tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

export function hasAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}
