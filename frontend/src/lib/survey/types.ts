export type Platform = "phone" | "sms" | "web" | "discord" | "other";
export type Demand = "cash" | "gift_card" | "wire" | "crypto" | "check" | "other";
export type AgeBand = "child" | "adult" | "older" | "unknown";
export type Arrival = "phone" | "extension" | "own" | "unknown";
export type ScamOrigin = "reddit" | "grok" | "both";
export type QuestionnairePriority = "high" | "medium" | "low";

export interface ScamTags {
  channels: string[];
  hooks: string[];
  asks: string[];
  signals: string[];
}

export interface Scam {
  id: string;
  slug: string;
  name: string;
  platforms: Platform[];
  aiGenerated: boolean | null;
  victimRoles: string[];
  demands: Demand[];
  description: string;
  frequency: number;
  signals: string[];
  examples: string[];
  whatToDo: string[];
  simpleWhatToDo: string[];
  tags: ScamTags;
  catalogIds: string[];
  aliases: string[];
  origin: ScamOrigin;
  questionnairePriority: QuestionnairePriority | null;
  seedDescription?: string;
  reportTo?: string[];
}

export interface QuestionOption {
  id: string;
  label: string;
}

export type QuestionKind = "yesno" | "choice" | "text" | "upload";

export interface Question {
  id: string;
  prompt: string;
  helper?: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  /** Lower numbers are asked first, before information-gain selection. */
  priority?: number;
  /** Hide this question given answers already collected. */
  skipIf?: (answers: Record<string, string>) => boolean;
  /**
   * Whether this scam fits the given answer.
   * true = evidence for, false = evidence against, null = unknown / ignore.
   */
  matches: (scam: Scam, value: string) => boolean | null;
  reason?: (scam: Scam, value: string) => string | null;
}

export interface Answer {
  questionId: string;
  value: string;
}

export interface RankedScam {
  scam: Scam;
  score: number;
  confidence: number;
  reasons: string[];
}

export interface SurveySnapshot {
  answers: Answer[];
  ranked: RankedScam[];
  remaining: number;
}

export interface VisitorProfile {
  age: AgeBand;
  arrival: Arrival;
  simplified: boolean;
}

export const SKIP = "skip";

export const YESNO_OPTIONS: QuestionOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

export function isNeutral(value: string | undefined): boolean {
  return !value || value === SKIP || value === "unsure" || value.trim() === "";
}
