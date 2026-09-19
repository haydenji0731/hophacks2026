#!/usr/bin/env node
/**
 * Node unit tests for the pure score engine.
 * Usage: node extension/scripts/test-score.mjs
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { ALLOWED_STORAGE_KEYS, LINK_HIT_SCORE, STORAGE_KEYS } from "../src/shared/constants.js";
import { compileRules } from "../src/shared/compileRules.js";
import { score } from "../src/shared/score.js";
import { compileHosts, hostnameFromHref } from "../src/content/links.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "rules/rules.json"), "utf8"));
const casesDoc = JSON.parse(readFileSync(join(root, "testdata/cases.json"), "utf8"));

const compiled = compileRules(catalog);
const soft = compiled.thresholdSoft;
const hard = compiled.thresholdHard;

let failed = 0;
const rows = [];

for (const testCase of casesDoc.cases) {
  const result = score(testCase.text, compiled);
  const errors = [];
  const expect = testCase.expect || {};

  if (typeof expect.minScore === "number" && result.score < expect.minScore) {
    errors.push(`score ${result.score} < min ${expect.minScore}`);
  }
  if (typeof expect.maxScore === "number" && result.score > expect.maxScore) {
    errors.push(`score ${result.score} > max ${expect.maxScore}`);
  }
  if (expect.underSoft && result.score >= soft) {
    errors.push(`wanted under soft (${soft}), got ${result.score}`);
  }
  if (expect.underHard && result.score >= hard) {
    errors.push(`wanted under hard (${hard}), got ${result.score}`);
  }
  if (expect.topScamId && result.topScamId !== expect.topScamId) {
    errors.push(`topScamId ${result.topScamId} != ${expect.topScamId}`);
  }
  if (Array.isArray(expect.mustMatch)) {
    for (const id of expect.mustMatch) {
      if (!result.matchedRuleIds.includes(id)) {
        errors.push(`missing rule ${id}`);
      }
    }
  }
  if (result.reasons.some((reason) => testCase.text && reason.includes(testCase.text))) {
    errors.push("reason echoed source sentence");
  }

  const ok = errors.length === 0;
  if (!ok) failed += 1;
  rows.push({ id: testCase.id, score: result.score, top: result.topScamId, ok, errors, reasons: result.reasons });
}

for (const row of rows) {
  const mark = row.ok ? "PASS" : "FAIL";
  const extra = row.ok
    ? `score=${row.score} top=${row.top || "-"}`
    : row.errors.join("; ");
  console.log(`${mark}  ${row.id}  ${extra}`);
  if (!row.ok) console.log(`      reasons: ${row.reasons.join(", ") || "(none)"}`);
}

const extras = [];
const disabled = score("Please install TeamViewer now.", compiled, {
  disabledRuleIds: ["tool_teamviewer"],
});
extras.push({
  id: "disabled_rule_skipped",
  ok: !disabled.matchedRuleIds.includes("tool_teamviewer"),
  errors: disabled.matchedRuleIds.includes("tool_teamviewer")
    ? ["disabled rule still matched"]
    : [],
});

const allowed = new Set(ALLOWED_STORAGE_KEYS);
const required = [
  STORAGE_KEYS.enabled,
  STORAGE_KEYS.sitesEnabled,
  STORAGE_KEYS.rulesVersion,
  STORAGE_KEYS.warningsShown,
  STORAGE_KEYS.userDisabledRuleIds,
];
const missingKeys = required.filter((key) => !allowed.has(key));
extras.push({
  id: "storage_allowlist",
  ok: missingKeys.length === 0 && allowed.size === required.length,
  errors: missingKeys.length ? [`missing ${missingKeys.join(",")}`] : [],
});

const hostDoc = JSON.parse(readFileSync(join(root, "rules/hosts.json"), "utf8"));
const hostSet = compileHosts(hostDoc);
const badHost = hostnameFromHref("https://irs-refund-secure.com/pay");
const goodHost = hostnameFromHref("https://www.linkedin.com/in/example");
extras.push({
  id: "l1_host_set",
  ok: hostSet.has(badHost) && !hostSet.has(goodHost),
  errors: hostSet.has(badHost) && !hostSet.has(goodHost)
    ? []
    : [`bad=${badHost} good=${goodHost}`],
});

const linkText = score("Verify your refund here: irs-refund-secure.com", compiled);
const linkCombined = linkText.score + (hostSet.has(badHost) ? LINK_HIT_SCORE : 0);
extras.push({
  id: "fixture_suspicious_link",
  ok: linkCombined >= hard,
  errors: linkCombined >= hard ? [] : [`combined ${linkCombined} < hard ${hard}`],
});

for (const row of extras) {
  if (!row.ok) failed += 1;
  console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.id}  ${row.errors.join("; ") || "ok"}`);
  rows.push(row);
}

console.log("");
console.log(
  `rules v${compiled.version}: ${catalog.rules.length} rules, ${catalog.combos.length} combos, soft=${soft} hard=${hard}`,
);
console.log(`${rows.length - failed}/${rows.length} passed`);

if (failed) process.exit(1);
