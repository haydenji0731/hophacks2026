/**
 * Converts the pattern TSV plus the method catalog into the JSON the site
 * scores against. Catalog ids that already exist as slugs are merged
 * instead of duplicated.
 *
 * Usage: node scripts/convert-scams.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const tsvPath = join(root, "data", "reddit_scam_patterns.062126_091926.tsv");
const catalogPath = join(root, "data", "scam-catalog.json");
const outPath = join(root, "src", "data", "scams.json");
