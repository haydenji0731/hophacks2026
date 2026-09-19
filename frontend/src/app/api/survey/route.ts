import { NextResponse } from "next/server";
import { QUESTIONS, buildSnapshot } from "@/lib/survey/engine";
import type { Answer } from "@/lib/survey/types";

export async function GET() {
  return NextResponse.json({
    questions: QUESTIONS.map(({ id, prompt, helper, kind, options }) => ({
      id,
      prompt,
      helper,
      kind,
      options,
    })),
  });
}

export async function POST(request: Request) {
  let body: { answers?: Answer[] } = {};
  try {
    body = (await request.json()) as { answers?: Answer[] };
  } catch {
    return NextResponse.json({ error: "Expected JSON { answers: [...] }" }, { status: 400 });
  }

  const answers = Array.isArray(body.answers) ? body.answers : [];
  const snapshot = buildSnapshot(answers);
  return NextResponse.json({
    answers: snapshot.answers,
    remaining: snapshot.remaining,
    ranked: snapshot.ranked.slice(0, 8).map((row) => ({
      slug: row.scam.slug,
      name: row.scam.name,
      score: Number(row.score.toFixed(3)),
      confidence: Number(row.confidence.toFixed(3)),
      reasons: row.reasons,
      frequency: row.scam.frequency,
    })),
  });
}
