import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const partsDir = join(root, "src", "data", "scams.parts");
const outPath = join(root, "src", "data", "scams.json");
const parts = readdirSync(partsDir)
  .filter((name) => name.endsWith(".txt"))
  .sort();
if (parts.length === 0) {
  throw new Error(`No scam parts in ${partsDir}`);
}
const json = parts.map((name) => readFileSync(join(partsDir, name), "utf8")).join("");
const data = JSON.parse(json);
if (!Array.isArray(data) || data.length < 100) {
  throw new Error(`Expected full scams array, got ${Array.isArray(data) ? data.length : typeof data}`);
}
writeFileSync(outPath, json);
console.log(`Assembled ${data.length} scams from ${parts.length} parts -> ${outPath}`);
