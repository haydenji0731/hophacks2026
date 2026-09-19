import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const partsDir = join(dir, "convert-scams.parts");
const parts = readdirSync(partsDir)
  .filter((name) => name.endsWith(".txt"))
  .sort();
if (parts.length === 0) {
  throw new Error(`No convert-scams parts in ${partsDir}`);
}
const body = parts.map((name) => readFileSync(join(partsDir, name), "utf8")).join("");
const out = join(dir, "_convert-scams.bundle.mjs");
writeFileSync(out, body);
await import(pathToFileURL(out).href);
