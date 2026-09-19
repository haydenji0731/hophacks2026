/**
 * Compile rules.json once per worker/page load.
 * Never re-parse on mutations. Pure — no DOM, no Chrome.
 */

const DEFAULT_PHRASE_CHAR_CAP = 4000;

/**
 * @typedef {{
 *   id: string,
 *   pattern: string,
 *   type: "token" | "phrase",
 *   weight: number,
 *   scamIds: string[],
 *   label?: string,
 * }}
 RawRule
 *
 * @typedef {{
 *   id: string,
 *   weight: number,
 *   scamIds: string[],
 *   label: string,
 *   type: string,
 * }}
 RuleRef
 */

export function normalizePhrase(pattern) {
  return String(pattern || "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function phraseTokens(pattern) {
  const normalized = normalizePhrase(pattern);
  return normalized ? normalized.split(" ") : [];
}

/**
 * @param {object} catalog rules.json shape
 * @param {{ phraseCharCap?: number, disabledRuleIds?: string[] }} [opts]
 */
export function compileRules(catalog, opts = {}) {
  const tokenMap = new Map();
  const phrases = [];
  const ruleById = new Map();
  const disabled = new Set(opts.disabledRuleIds || []);

  const rules = Array.isArray(catalog?.rules) ? catalog.rules : [];
  for (const raw of rules) {
    if (!raw || !raw.id || !raw.pattern) continue;
    if (disabled.has(raw.id)) continue;

    const tokens = phraseTokens(raw.pattern);
    if (!tokens.length) continue;

    const ref = {
      id: raw.id,
      weight: Number(raw.weight) || 0,
      scamIds: Array.isArray(raw.scamIds) ? raw.scamIds.slice() : [],
      label: raw.label || raw.id,
      type: raw.type === "phrase" || tokens.length > 1 ? "phrase" : "token",
      tokens,
    };
    ruleById.set(ref.id, ref);

    if (ref.type === "phrase") {
      phrases.push({
        ...ref,
        normalized: tokens.join(" "),
      });
    } else {
      const key = tokens[0];
      const list = tokenMap.get(key);
      if (list) list.push(ref);
      else tokenMap.set(key, [ref]);
    }
  }

  const combos = [];
  for (const raw of Array.isArray(catalog?.combos) ? catalog.combos : []) {
    if (!raw || !Array.isArray(raw.allOf) || !raw.allOf.length) continue;
    combos.push({
      id: raw.id || `combo_${raw.allOf.join("_")}`,
      allOf: raw.allOf.slice(),
      bonus: Number(raw.bonus) || 0,
      scamIds: Array.isArray(raw.scamIds) ? raw.scamIds.slice() : [],
      label: raw.label || raw.id || "combo",
    });
  }

  return {
    version: Number(catalog?.version) || 0,
    thresholdSoft: Number(catalog?.thresholdSoft) || 4,
    thresholdHard: Number(catalog?.thresholdHard) || 8,
    tokenMap,
    phrases,
    combos,
    ruleById,
    phraseCharCap: opts.phraseCharCap || DEFAULT_PHRASE_CHAR_CAP,
  };
}
