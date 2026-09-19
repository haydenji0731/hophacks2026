import { STORAGE_KEY, buildSnapshot } from "./engine";
import type { Answer, SurveySnapshot } from "./types";

export function saveSurvey(answers: Answer[]): SurveySnapshot {
  const snapshot = buildSnapshot(answers);
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ answers: snapshot.answers })
    );
  }
  return snapshot;
}

export function loadSurvey(): SurveySnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { answers?: Answer[] };
    if (!parsed.answers) return null;
    return buildSnapshot(parsed.answers);
  } catch {
    return null;
  }
}

export function clearSurvey() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}
