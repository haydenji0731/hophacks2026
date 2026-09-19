import type { ComboRule, CueHit, Family } from "./types";

export function applyCombos(
  hits: CueHit[],
  rules: ComboRule[],
): { bonus: number; reasons: string[] } {
  const families = new Set<Family>(hits.map((h) => h.family));
  let bonus = 0;
  const reasons: string[] = [];
  for (const rule of rules) {
    if (rule.families.every((f) => families.has(f))) {
      bonus += rule.bonus;
      reasons.push(rule.reason);
    }
  }
  return { bonus, reasons };
}
