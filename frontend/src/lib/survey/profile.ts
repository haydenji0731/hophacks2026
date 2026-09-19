import { answersMap } from "./engine-answers";
import type { AgeBand, Answer, Arrival, VisitorProfile } from "./types";

export function profileFromAnswers(answers: Answer[]): VisitorProfile {
  const map = answersMap(answers);
  const age: AgeBand =
    map.age === "child" || map.age === "adult" || map.age === "older"
      ? map.age
      : "unknown";
  const arrival: Arrival =
    map.source === "phone" || map.source === "extension" || map.source === "own"
      ? map.source
      : "unknown";
  return {
    age,
    arrival,
    simplified: age === "child" || age === "older",
  };
}

export function nextSteps(scam: { whatToDo: string[]; simpleWhatToDo: string[] }, profile: VisitorProfile): string[] {
  if (profile.simplified) {
    const extra =
      profile.age === "child"
        ? "Tell a parent, teacher, or another adult you trust. You are not in trouble."
        : "Call someone you trust before you send anything. Scammers count on you handling this alone.";
    const base = scam.simpleWhatToDo.slice(0, 3);
    if (!base.includes(extra)) base.push(extra);
    return base.slice(0, 4);
  }
  return scam.whatToDo;
}

export function resultLimit(profile: VisitorProfile): number {
  return profile.simplified ? 1 : 4;
}
