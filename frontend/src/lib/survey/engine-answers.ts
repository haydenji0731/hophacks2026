import type { Answer } from "./types";

export function answersMap(answers: Answer[]): Record<string, string> {
  return Object.fromEntries(answers.map((answer) => [answer.questionId, answer.value]));
}
