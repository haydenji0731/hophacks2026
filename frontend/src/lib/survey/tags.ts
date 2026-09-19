import type { Scam, ScamTags } from "./types";

export type TagGroup = keyof ScamTags;

export type TagSpec = Partial<Record<TagGroup, string[]>>;

export function emptyTags(): ScamTags {
  return { channels: [], hooks: [], asks: [], signals: [] };
}

export function tagsOf(scam: Scam): ScamTags {
  return scam.tags ?? emptyTags();
}

export function hasTag(scam: Scam, group: TagGroup, values: string[]): boolean {
  const have = new Set(tagsOf(scam)[group]);
  return values.some((value) => have.has(value));
}

export function tagMatch(scam: Scam, spec: TagSpec, mode: "any" | "all" = "any"): boolean {
  const checks: boolean[] = [];
  (["channels", "hooks", "asks", "signals"] as const).forEach((group) => {
    const wanted = spec[group];
    if (!wanted?.length) return;
    checks.push(hasTag(scam, group, wanted));
  });
  if (checks.length === 0) return false;
  return mode === "all" ? checks.every(Boolean) : checks.some(Boolean);
}

/** True if this scam is the method id or a slug it was merged onto. */
export function isMethod(scam: Scam, ...ids: string[]): boolean {
  const have = new Set([scam.slug, ...(scam.catalogIds ?? [])]);
  return ids.some((id) => have.has(id));
}

/**
 * Exclusive choice scoring: the selected option matches this scam,
 * or a sibling option does (evidence against), or nobody matches (ignore).
 */
export function exclusiveTagMatch(
  scam: Scam,
  value: string,
  optionTags: Record<string, TagSpec>,
  fallback?: (scam: Scam, value: string) => boolean | null
): boolean | null {
  if (value === "other") return null;
  const spec = optionTags[value];
  if (!spec) return fallback?.(scam, value) ?? null;
  if (tagMatch(scam, spec)) return true;
  const siblingHit = Object.entries(optionTags).some(
    ([id, other]) => id !== value && id !== "other" && tagMatch(scam, other)
  );
  if (siblingHit) return false;
  return fallback?.(scam, value) ?? null;
}

export function exclusiveMethodMatch(
  scam: Scam,
  value: string,
  optionMethods: Record<string, string[]>
): boolean | null {
  if (value === "other") return null;
  const mine = optionMethods[value];
  if (!mine) return null;
  if (isMethod(scam, ...mine)) return true;
  const siblingHit = Object.entries(optionMethods).some(
    ([id, ids]) => id !== value && id !== "other" && isMethod(scam, ...ids)
  );
  return siblingHit ? false : null;
}
