import scamsJson from "@/data/scams.json";
import { answersMap } from "./engine-answers";
import { QUESTIONS, QUESTION_BY_ID } from "./questions";
import { blob, tokenize } from "./text";
import type {
  Answer,
  Question,
  RankedScam,
  Scam,
  SurveySnapshot,
} from "./types";
import { isNeutral } from "./types";

export { QUESTIONS, QUESTION_BY_ID };
export { answersMap };

export const SCAMS = scamsJson as Scam[];

const MATCH = 2.4;
const MISMATCH = -1.6;
const PRIOR_SCALE = 0.35;
const TEXT_HIT = 0.45;
const STOP_AFTER = 7;
const CONFIDENT_TOP = 0.42;
const CONFIDENT_GAP = 0.14;
const META_QUESTIONS = new Set(["source", "age", "notify_about", "evidence", "details"]);

function prior(scam: Scam): number {
  const catalogBoost = scam.questionnairePriority === "high" ? 0.12 : scam.questionnairePriority === "medium" ? 0.05 : 0;
  return PRIOR_SCALE * Math.log(1 + scam.frequency) + catalogBoost;
}

function textBoost(scam: Scam, details: string): { score: number; reasons: string[] } {
  const tokens = tokenize(details);
  if (tokens.length === 0) return { score: 0, reasons: [] };
  const haystack = blob(scam);
  const hits = [...new Set(tokens.filter((token) => haystack.includes(token)))];
  if (hits.length === 0) return { score: 0, reasons: [] };
  return {
    score: Math.min(2.8, hits.length * TEXT_HIT),
    reasons: [`Matched details: ${hits.slice(0, 6).join(", ")}`],
  };
}

export function scoreScam(scam: Scam, answers: Answer[]): { score: number; reasons: string[] } {
  let score = prior(scam);
  const reasons: string[] = [];

  for (const answer of answers) {
    const question = QUESTION_BY_ID[answer.questionId];
    if (!question || isNeutral(answer.value)) continue;

    if (question.kind === "text" || question.kind === "upload") {
      const boost = textBoost(scam, answer.value);
      score += boost.score;
      reasons.push(...boost.reasons);
      continue;
    }

    const match = question.matches(scam, answer.value);
    if (match === true) {
      score += MATCH;
      const reason = question.reason?.(scam, answer.value);
      if (reason) reasons.push(reason);
    } else if (match === false) {
      score += MISMATCH;
    }
  }

  return { score, reasons };
}

function softmax(values: number[]): number[] {
  const max = Math.max(...values, 0);
  const exps = values.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0) || 1;
  return exps.map((value) => value / sum);
}

export function rankScams(answers: Answer[], pool: Scam[] = SCAMS): RankedScam[] {
  const scored = pool.map((scam) => {
    const { score, reasons } = scoreScam(scam, answers);
    return { scam, score, reasons, confidence: 0 };
  });
  const confidences = softmax(scored.map((row) => row.score));
  return scored
    .map((row, index) => ({ ...row, confidence: confidences[index] }))
    .sort((a, b) => b.score - a.score || b.scam.frequency - a.scam.frequency);
}

function entropy(weights: number[]): number {
  const total = weights.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return 0;
  return weights.reduce((acc, value) => {
    if (value <= 0) return acc;
    const p = value / total;
    return acc - p * Math.log2(p);
  }, 0);
}

function optionIds(question: Question): string[] {
  if (question.kind === "yesno") return ["yes", "no"];
  return (question.options ?? []).map((option) => option.id).filter((id) => id !== "unsure" && id !== "skip");
}

export function informationGain(question: Question, ranked: RankedScam[]): number {
  const parent = entropy(ranked.map((row) => row.confidence));
  const buckets = new Map<string, number>();
  for (const option of optionIds(question)) buckets.set(option, 0);
  buckets.set("other", 0);

  for (const row of ranked) {
    let placed = false;
    for (const option of optionIds(question)) {
      if (question.matches(row.scam, option) === true) {
        buckets.set(option, (buckets.get(option) ?? 0) + row.confidence);
        placed = true;
        break;
      }
    }
    if (!placed) {
      buckets.set("other", (buckets.get("other") ?? 0) + row.confidence);
    }
  }

  const child = entropy([...buckets.values()]);
  return parent - child;
}

export function visibleQuestions(answers: Answer[]): Question[] {
  const map = answersMap(answers);
  const asked = new Set(answers.map((answer) => answer.questionId));
  return QUESTIONS.filter((question) => {
    if (asked.has(question.id)) return false;
    if (question.skipIf?.(map)) return false;
    return true;
  });
}

export function selectNextQuestion(
  answers: Answer[],
  ranked: RankedScam[] = rankScams(answers)
): Question | null {
  const remaining = visibleQuestions(answers);
  if (remaining.length === 0) return null;

  const priority = remaining
    .filter((question) => question.priority != null)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  if (priority.length > 0) return priority[0];

  const scoredQuestions = remaining
    .filter((question) => question.kind !== "text" && question.kind !== "upload")
    .map((question) => ({
      question,
      gain: informationGain(question, ranked),
    }))
    .sort((a, b) => b.gain - a.gain);

  if (scoredQuestions.length === 0) {
    return remaining.find((question) => question.kind === "text" || question.kind === "upload") ?? null;
  }

  return scoredQuestions[0].question;
}

export function shouldStop(answers: Answer[], ranked: RankedScam[]): boolean {
  if (visibleQuestions(answers).some((question) => question.priority != null)) {
    return false;
  }
  const asked = answers.filter((answer) => {
    const question = QUESTION_BY_ID[answer.questionId];
    return question && !META_QUESTIONS.has(question.id) && question.kind !== "text" && question.kind !== "upload";
  });
  if (asked.length >= STOP_AFTER) return true;
  if (asked.length < 3) return false;
  const [top, second] = ranked;
  if (!top || !second) return true;
  return top.confidence >= CONFIDENT_TOP && top.confidence - second.confidence >= CONFIDENT_GAP;
}

export function buildSnapshot(answers: Answer[]): SurveySnapshot {
  const ranked = rankScams(answers);
  return {
    answers,
    ranked,
    remaining: visibleQuestions(answers).filter(
      (question) => question.kind !== "text" && question.kind !== "upload"
    ).length,
  };
}

export function findScam(slug: string): Scam | undefined {
  return SCAMS.find((scam) => scam.slug === slug || scam.id === slug);
}

export function searchScams(query: string): Scam[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return SCAMS;
  return SCAMS.filter((scam) => {
    const haystack = blob(scam);
    return tokens.every((token) => haystack.includes(token));
  });
}

export const STORAGE_KEY = "whs-survey-v1";
export const REPORTS_KEY = "whs-reports-v1";
