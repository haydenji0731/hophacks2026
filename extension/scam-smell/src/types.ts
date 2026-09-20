export type Family =
  | "urgency"
  | "reward"
  | "payment"
  | "credential"
  | "authority"
  | "secrecy"
  | "action"
  | "job_romance_ops";

export type Band = "ok" | "caution" | "high";

export type ScamCategory =
  | "phishing"
  | "romance"
  | "advance_fee"
  | "job"
  | "giveaway"
  | "tech_support"
  | "investment"
  | "other";

export type Cue = {
  id: string;
  family: Family;
  patterns: string[];
  weight: number;
  negation_safe?: boolean;
};

export type AssociationEdge = {
  a: string;
  b: string;
  strength: number;
};

export type ComboRule = {
  id: string;
  families: Family[];
  bonus: number;
  reason: string;
};

export type BenignPattern = {
  id: string;
  patterns: string[];
  weight: number;
};

export type CueHit = {
  cueId: string;
  family: Family;
  weight: number;
  start: number;
  end: number;
  tokenIndex: number;
  negationSafe: boolean;
};

export type Highlight = {
  start: number;
  end: number;
  family: string;
};

export type ScamSmellResult = {
  score: number;
  band: Band;
  reasons: string[];
  highlights: Highlight[];
  category: ScamCategory;
};

export type Token = {
  text: string;
  start: number;
  end: number;
  index: number;
};

export type NormalizedText = {
  original: string;
  text: string;
  map: number[];
};
