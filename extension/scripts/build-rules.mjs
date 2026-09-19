#!/usr/bin/env node
/**
 * Optional catalog → rules.json helper.
 * v1 ships a hand-seeded rules/rules.json; this script validates it
 * and prints a compact summary instead of regenerating from scratch.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compileRules } from "../src/shared/compileRules.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const catalog = JSON.parse(readFileSync(join(root, "rules/rules.json"), "utf8"));
const compiled = compileRules(catalog);

const tokens = compiled.tokenMap.size;
const phrases = compiled.phrases.length;
const ids = new Set(catalog.rules.map((r) => r.id));
const dupes = catalog.rules.length - ids.size;
const missingCombo = [];
for (const combo of compiled.combos) {
  for (const id of combo.allOf) {
    if (!ids.has(id)) missingCombo.push(`${combo.id}:${id}`);
  }
}

console.log(`rules v${compiled.version}`);
console.log(`  raw rules: ${catalog.rules.length}`);
console.log(`  token keys: ${tokens}`);
console.log(`  phrases: ${phrases}`);
console.log(`  combos: ${compiled.combos.length}`);
console.log(`  soft=${compiled.thresholdSoft} hard=${compiled.thresholdHard}`);
if (dupes) console.error(`duplicate ids: ${dupes}`);
if (missingCombo.length) console.error(`combo refs missing: ${missingCombo.join(", ")}`);
if (catalog.rules.length < 30 || catalog.rules.length > 60) {
  console.error("expected ~30–50 seeded rules");
  process.exit(1);
}
if (dupes || missingCombo.length) process.exit(1);
console.log("ok");
