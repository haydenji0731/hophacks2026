import { answersMap } from "./engine-answers";
import type { Answer, Demand, Platform, Scam } from "./types";

/** Payload for existing `POST /v1/report` on backend/detector (unchanged). */
export interface DetectorReportPayload {
  scam_type: string;
  method: string;
  target: string;
  reasoning: string;
  ai_generated: boolean | null;
  platform: Platform;
}

const METHOD: Record<string, string> = {
  gift_card: "gift card payment request",
  wire: "wire transfer request",
  crypto: "crypto payment request",
  check: "fake check overpayment",
  cash: "payment app transfer",
  otp: "phishing link or code request",
  remote: "phishing link or code request",
  password: "phishing link or code request",
  wallet: "crypto payment request",
};

const TARGET: Record<string, string> = {
  government: "general consumer",
  bank: "account holder",
  brand: "account holder",
  tech: "computer user",
  account: "computer user",
  family: "family member / older adult",
  romance: "dating app user",
  job: "job seeker",
  marketplace: "marketplace buyer / seller",
};

function platformFromAnswers(map: Record<string, string>): Platform {
  if (map.source === "phone" || map.channel === "phone") return "phone";
  if (map.channel === "sms") return "sms";
  if (map.channel === "discord") return "discord";
  if (["web", "social", "dating", "marketplace", "chat"].includes(map.channel)) return "web";
  if (map.source === "extension") return "web";
  return "other";
}

function methodFromAnswers(map: Record<string, string>, scam: Scam): string {
  if (map.demand && METHOD[map.demand]) return METHOD[map.demand];
  if (map.ask_kind && METHOD[map.ask_kind]) return METHOD[map.ask_kind];
  const demand = scam.demands.find((item: Demand) => item !== "other");
  if (demand && METHOD[demand]) return METHOD[demand];
  return "none";
}

function targetFromAnswers(map: Record<string, string>): string {
  return TARGET[map.hook_who] || TARGET[map.theme] || TARGET[map.notify_about] || "unclear";
}

export function detectorReportPayload(scam: Scam, answers: Answer[]): DetectorReportPayload {
  const map = answersMap(answers);
  const lines = answers
    .filter((answer) => answer.value && answer.value !== "skip")
    .map((answer) => `${answer.questionId}: ${answer.value}`);
  return {
    scam_type: scam.name,
    method: methodFromAnswers(map, scam),
    target: targetFromAnswers(map),
    reasoning: lines.join(" ").slice(0, 4000),
    ai_generated: null,
    platform: platformFromAnswers(map),
  };
}

export type DetectorReportResult =
  | { ok: true; message: string }
  | { ok: false; message: string };

export async function postDetectorReport(
  scam: Scam,
  answers: Answer[]
): Promise<DetectorReportResult> {
  try {
    const response = await fetch("/api/v1/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(detectorReportPayload(scam, answers)),
    });
    const body = (await response.json().catch(() => ({}))) as {
      detail?: { detail?: string } | string;
      db?: { action?: string; frequency?: number };
      warnings?: string[];
    };
    if (!response.ok) {
      const detail =
        typeof body.detail === "string"
          ? body.detail
          : body.detail?.detail || "Could not save this report.";
      throw new Error(detail);
    }
    const action = body.db?.action;
    if (action === "created") {
      return { ok: true, message: "Saved to the detector database. This pattern is now in the repository." };
    }
    if (action === "updated") {
      return {
        ok: true,
        message: `Saved. This pattern has been seen ${body.db?.frequency ?? "multiple"} times.`,
      };
    }
    return {
      ok: false,
      message:
        (body.warnings && body.warnings[0]) ||
        "Saved on this device, but the database skipped the write. Is Postgres and backend/detector running on port 8000?",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save this report.";
    if (message.includes("fetch") || message.includes("Failed")) {
      return {
        ok: false,
        message:
          "Could not reach the detector. Start backend/detector on port 8000, or keep the on-device save.",
      };
    }
    return { ok: false, message };
  }
}
