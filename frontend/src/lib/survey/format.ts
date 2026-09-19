import type { Demand, Platform, Scam } from "./types";

const PLATFORM_LABEL: Record<Platform, string> = {
  phone: "Phone",
  sms: "Text",
  web: "Web / email",
  discord: "Discord",
  other: "Chat / other",
};

const DEMAND_LABEL: Record<Demand, string> = {
  cash: "Cash / app payment",
  gift_card: "Gift cards",
  wire: "Wire",
  crypto: "Crypto",
  check: "Check",
  other: "Other",
};

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

export function demandLabel(demand: Demand): string {
  return DEMAND_LABEL[demand] ?? demand;
}

export function percent(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

export function frequencyLabel(scam: Scam): string {
  if (scam.frequency >= 40) return `${scam.frequency} recent reports`;
  if (scam.frequency <= 1) return scam.frequency === 1 ? "1 report" : "Listed pattern";
  return `${scam.frequency} reports`;
}
