import { REPORTS_KEY } from "./engine";

export interface ScamReport {
  id: string;
  createdAt: string;
  pattern: string;
  patternLabel: string;
  channel: string;
  demand: string;
  notes: string;
  evidenceName: string;
}

export function loadReports(): ScamReport[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(REPORTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScamReport[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReport(report: Omit<ScamReport, "id" | "createdAt">): ScamReport {
  const entry: ScamReport = {
    ...report,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...loadReports()].slice(0, 50);
  window.localStorage.setItem(REPORTS_KEY, JSON.stringify(next));
  return entry;
}
