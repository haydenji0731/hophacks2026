import { STORAGE_KEY, buildSnapshot } from "./engine";
import type { Answer, SurveySnapshot } from "./types";

let cachedRaw: string | null | undefined;
let cachedSnapshot: SurveySnapshot | null = null;

function writeCache(raw: string | null, snapshot: SurveySnapshot | null) {
  cachedRaw = raw;
  cachedSnapshot = snapshot;
}

export function saveSurvey(answers: Answer[]): SurveySnapshot {
  const snapshot = buildSnapshot(answers);
  const raw = JSON.stringify({ answers: snapshot.answers });
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem(STORAGE_KEY, raw);
  }
  writeCache(raw, snapshot);
  return snapshot;
}

export function loadSurvey(): SurveySnapshot | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  if (!raw) {
    writeCache(null, null);
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { answers?: Answer[] };
    const snapshot = parsed.answers ? buildSnapshot(parsed.answers) : null;
    writeCache(raw, snapshot);
    return snapshot;
  } catch {
    writeCache(raw, null);
    return null;
  }
}

export function clearSurvey() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
  writeCache(null, null);
}
