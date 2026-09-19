/**
 * Pure scoring engine. text → { score, reasons, topScamId }.
 * No DOM. Never returns the source sentence.
 */

import { normalizePhrase } from "./compileRules.js";

export function tokenize(text) {
  const normalized = normalizePhrase(text);
  return normalized ? normalized.split(" ") : [];
}

function addScamWeights(bucket, scamIds, weight) {
  for (const id of scamIds) {
    bucket[id] = (bucket[id] || 0) + weight;
  }
}

function topKey(bucket) {
  let best = null;
  let bestWeight = 0;
  for (const [id, weight] of Object.entries(bucket)) {
    if (weight > bestWeight) {
      best = id;
      bestWeight = weight;
    }
  }
  return best;
}

/**
 * @param {string} text
 * @param {ReturnType<import("./compileRules.js").compileRules>} compiled
 * @param {{ disabledRuleIds?: string[] }} [opts]
 * @returns {{
 *   score: number,
 *   matchedRuleIds: string[],
 *   reasons: string[],
 *   topScamId: string | null,
 *   comboIds: string[],
 * }}
 */
export function score(text, compiled, opts = {}) {
  if (!compiled || !text) {
    return {
      score: 0,
      matchedRuleIds: [],
      reasons: [],
      topScamId: null,
      comboIds: [],
    };
  }

  const disabled = new Set(opts.disabledRuleIds || []);
  const tokens = tokenize(text);
  const matched = new Map();

  for (const tok of tokens) {
    const refs = compiled.tokenMap.get(tok);
    if (!refs) continue;
    for (const ref of refs) {
      if (disabled.has(ref.id) || matched.has(ref.id)) continue;
      matched.set(ref.id, ref);
    }
  }

  const underCap = text.length <= (compiled.phraseCharCap || 4000);
  if (underCap && compiled.phrases.length) {
    const hay = ` ${tokens.join(" ")} `;
    for (const phrase of compiled.phrases) {
      if (disabled.has(phrase.id) || matched.has(phrase.id)) continue;
      if (hay.includes(` ${phrase.normalized} `)) {
        matched.set(phrase.id, phrase);
      }
    }
  }

  // A matched phrase consumes its tokens so "gift card" does not also
  // charge the weak standalone "gift" token.
  const consumed = new Set();
  for (const ref of matched.values()) {
    if (ref.type === "phrase" && Array.isArray(ref.tokens)) {
      for (const tok of ref.tokens) consumed.add(tok);
    }
  }
  for (const [id, ref] of [...matched]) {
    if (ref.type !== "token") continue;
    const tok = ref.tokens?.[0];
    if (tok && consumed.has(tok)) matched.delete(id);
  }

  let total = 0;
  const scamWeights = Object.create(null);
  const matchedRuleIds = [];
  const reasons = [];

  for (const ref of matched.values()) {
    total += ref.weight;
    matchedRuleIds.push(ref.id);
    reasons.push(ref.label || ref.id);
    addScamWeights(scamWeights, ref.scamIds, ref.weight);
  }

  const matchedIds = new Set(matchedRuleIds);
  const comboIds = [];
  for (const combo of compiled.combos) {
    if (!combo.allOf.every((id) => matchedIds.has(id))) continue;
    total += combo.bonus;
    comboIds.push(combo.id);
    reasons.push(combo.label || combo.id);
    addScamWeights(scamWeights, combo.scamIds, combo.bonus);
  }

  return {
    score: total,
    matchedRuleIds,
    reasons,
    topScamId: topKey(scamWeights),
    comboIds,
  };
}
