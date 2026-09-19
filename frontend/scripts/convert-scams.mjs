import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));
const root = join(dir, "..");

function concatParts(partsDir, dest) {
  const parts = readdirSync(partsDir)
    .filter((name) => name.endsWith(".txt"))
    .sort();
  if (parts.length === 0) {
    throw new Error(`No parts in ${partsDir}`);
  }
  writeFileSync(
    dest,
    parts.map((name) => readFileSync(join(partsDir, name), "utf8")).join(""),
  );
}

concatParts(join(dir, "convert-scams.parts"), join(dir, "_convert-scams.bundle.mjs"));
concatParts(
  join(root, "data", "tsv.parts"),
  join(root, "data", "reddit_scam_patterns.062126_091926.tsv"),
);
concatParts(join(root, "data", "catalog.parts"), join(root, "data", "scam-catalog.json"));

await import(pathToFileURL(join(dir, "_convert-scams.bundle.mjs")).href);
