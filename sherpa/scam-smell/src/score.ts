import cuesFile from "../data/cues.json";
import associationsFile from "../data/associations.json";
import benignFile from "../data/benign.json";
import combosFile from "../data/combos.json";
import { associationBoost } from "./associate";
import { applyCombos } from "./combos";
import { capRepeats, matchCues } from "./matchCues";
import { normalize, tokenize } from "./normalize";
import { structuralSignals } from "./structural";
import type {
  AssociationEdge,
  Band,
  BenignPattern,
  ComboRule,
  Cue,
  CueHit,
  Family,
  ScamCategory,
  ScamSmellResult,
} from "./types";

const cues = (cuesFile as { cues: Cue[] }).cues;
const edges = (associationsFile as { edges: AssociationEdge[] }).edges;
const benign = (benignFile as { patterns: BenignPattern[] }).patterns;
const combos = combosFile as ComboRule[];

const FAMILY_REASON: Record<Family, string> = {
  urgency: "Pressure to act immediately.",
  reward: "Too-good-to-be-true prize or payout.",
  payment: "Asks for a hard-to-reverse payment.",
  credential: "Asks you to verify, log in, or hand over codes.",
  authority: "Pretends to be a trusted institution or official.",
  secrecy: "Tells you to keep it quiet.",
  action: "Pushes you to click, call, or open something.",
  job_romance_ops: "Job, romance, or package-mule pattern.",
};

function matchBenign(text: string): number {
  let score = 0;
  for (const item of benign) {
    for (const pattern of item.patterns) {
      const re = pattern.startsWith("re:")
        ? new RegExp(pattern.slice(3), "i")
        : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      if (re.test(text)) score += item.weight;
    }
  }
  return score;
}

function calibrate(raw: number): number {
  if (raw <= 0) return 0;
  if (raw < 6) return Math.round(raw * 3);
  if (raw < 18) return Math.round(18 + (raw - 6) * 2.4);
  if (raw < 34) return Math.round(47 + (raw - 18) * 1.7);
  return Math.min(100, Math.round(74 + (raw - 34) * 0.85));
}

function bandFor(score: number): Band {
  if (score >= 55) return "high";
  if (score >= 25) return "caution";
  return "ok";
}

function categoryFor(hits: CueHit[], text: string): ScamCategory {
  const ids = new Set(hits.map((h) => h.cueId));
  const families = new Set(hits.map((h) => h.family));
  if (
    ids.has("romance_love") ||
    ids.has("soldier_deployed") ||
    ids.has("widow") ||
    ids.has("sugar_daddy")
  ) {
    return "romance";
  }
  if (
    ids.has("prince_diplomat") ||
    ids.has("inheritance") ||
    ids.has("next_of_kin") ||
    ids.has("nigeria_lagos") ||
    ids.has("deceased_relative")
  ) {
    return "advance_fee";
  }
  if (
    ids.has("microsoft_support") ||
    ids.has("tech_remote") ||
    ids.has("apple_support")
  ) {
    return "tech_support";
  }
  if (
    ids.has("work_from_home") ||
    ids.has("receive_package") ||
    ids.has("reshipping") ||
    ids.has("task_job") ||
    ids.has("secret_shopper")
  ) {
    return "job";
  }
  if (
    ids.has("giveaway") ||
    ids.has("nitro_free") ||
    ids.has("you_have_won") ||
    ids.has("lottery")
  ) {
    return "giveaway";
  }
  if (ids.has("crypto_invest") || ids.has("recover_crypto") || ids.has("pig_butcher")) {
    return "investment";
  }
  if (families.has("credential") || ids.has("secure_link") || ids.has("login_link")) {
    return "phishing";
  }
  if (families.has("authority") && families.has("payment")) return "phishing";
  if (families.has("job_romance_ops")) return "romance";
  if (/\bnitro|giveaway|free steam\b/i.test(text)) return "giveaway";
  return "other";
}

function uniqueReasons(parts: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length === 3) break;
  }
  return out;
}

export function analyze(text: string): ScamSmellResult {
  const original = text ?? "";
  const normalized = normalize(original);
  if (!normalized.text) {
    return { score: 0, band: "ok", reasons: [], highlights: [], category: "other" };
  }
  const tokens = tokenize(normalized);
  const hits = matchCues(normalized, tokens, cues);
  const { raw: cueRaw } = capRepeats(hits);
  const assoc = associationBoost(hits, cues, edges);
  const combo = applyCombos(hits, combos);
  const structural = structuralSignals(original, normalized, hits);

  let raw = cueRaw + assoc + combo.bonus + structural.score;
  const families = new Set(hits.map((h) => h.family));
  const benignScore = matchBenign(normalized.text);
  if (benignScore > 0 && !families.has("payment") && !families.has("credential")) {
    raw = raw * 0.2 - benignScore;
  } else if (benignScore > 0) {
    raw -= Math.min(4, benignScore * 0.15);
  }

  // Bias toward caution: a single serious family plus action/link should not sit at 0.
  if (raw < 8 && (families.has("credential") || families.has("payment"))) {
    raw = Math.max(raw, 10);
  }

  const score = calibrate(raw);
  const band = bandFor(score);
  const familyReasons = [...families].map((f) => FAMILY_REASON[f]);
  const reasons =
    band === "ok"
      ? []
      : uniqueReasons([...combo.reasons, ...structural.reasons, ...familyReasons]);

  const highlights =
    band === "ok"
      ? []
      : hits.map((h) => ({ start: h.start, end: h.end, family: h.family }));

  return {
    score,
    band,
    reasons,
    highlights,
    category: band === "ok" ? "other" : categoryFor(hits, normalized.text),
  };
}

export type { ScamSmellResult, Band, ScamCategory } from "./types";
