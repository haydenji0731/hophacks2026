"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { RankedList } from "@/components/scam-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  QUESTIONS,
  rankScams,
  selectNextQuestion,
  shouldStop,
} from "@/lib/survey/engine";
import { postDetectorReport } from "@/lib/survey/backend-report";
import { profileFromAnswers, resultLimit } from "@/lib/survey/profile";
import { saveSurvey } from "@/lib/survey/session";
import {
  SKIP,
  YESNO_OPTIONS,
  type Answer,
  type Question,
} from "@/lib/survey/types";

const MAX_ASKED = QUESTIONS.filter(
  (question) => question.kind !== "text" && question.kind !== "upload"
).length;

async function readLocalText(file: File): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const readable =
    /^(text\/|application\/(json|csv|xml))/i.test(file.type) ||
    /\.(txt|csv|json|html|md|log)$/i.test(file.name);
  if (!readable) {
    return {
      ok: false,
      reason: "We cannot read screenshots or PDFs here. Paste a few lines of the chat instead.",
    };
  }
  const text = await file.text();
  return { ok: true, text };
}

export function SurveyBox() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [details, setDetails] = useState("");
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [forceResults, setForceResults] = useState(false);

  const ranked = useMemo(() => rankScams(answers), [answers]);
  const profile = useMemo(() => profileFromAnswers(answers), [answers]);
  const next = selectNextQuestion(answers);
  const done = forceResults || shouldStop(answers, ranked) || next === null;
  const pendingDetails =
    done && !answers.some((answer) => answer.questionId === "details");
  const current: Question | null = pendingDetails
    ? (QUESTIONS.find((question) => question.id === "details") ?? null)
    : done
      ? null
      : next;
  const showingResults = done && !pendingDetails;

  const askedCount = answers.filter(
    (answer) => answer.questionId !== "details" && answer.questionId !== "evidence"
  ).length;

  function answerQuestion(questionId: string, value: string, finish = false) {
    const nextAnswers = [
      ...answers.filter((answer) => answer.questionId !== questionId),
      { questionId, value },
    ];
    setAnswers(nextAnswers);
    saveSurvey(nextAnswers);
    setConfirmed(false);
    setConfirmMessage(null);
    setConfirmError(false);
    setFileError(null);
    if (finish) setForceResults(true);
  }

  function skipCurrent() {
    if (!current) return;
    answerQuestion(current.id, SKIP, current.kind === "text" || (current.kind === "upload" && done));
  }

  function submitDetails() {
    answerQuestion("details", details.trim(), true);
  }

  async function onFile(file: File | undefined) {
    if (!file || !current) return;
    const result = await readLocalText(file);
    if (!result.ok) {
      setFileError(result.reason);
      setFileName(file.name);
      return;
    }
    setFileName(file.name);
    setFileError(null);
    setDetails(result.text.slice(0, 8000));
    answerQuestion(current.id, result.text.slice(0, 8000));
  }

  function goBack() {
    setAnswers((prev) => {
      const nextAnswers = prev.slice(0, -1);
      saveSurvey(nextAnswers);
      return nextAnswers;
    });
    setConfirmed(false);
    setConfirmMessage(null);
    setConfirmError(false);
    setConfirming(false);
    setForceResults(false);
    setFileError(null);
  }

  function reset() {
    setAnswers([]);
    setDetails("");
    setConfirmed(false);
    setConfirmMessage(null);
    setConfirmError(false);
    setConfirming(false);
    setForceResults(false);
    setFileError(null);
    setFileName(null);
    saveSurvey([]);
  }

  async function confirmMatch() {
    const top = ranked[0]?.scam;
    if (!top || confirming) return;
    setConfirming(true);
    setConfirmError(false);
    const result = await postDetectorReport(top, answers);
    setConfirmed(true);
    setConfirming(false);
    setConfirmError(!result.ok);
    setConfirmMessage(result.message);
  }

  return (
    <Card id="survey" className="scroll-mt-24 bg-card">
      <CardHeader>
        <CardTitle className="font-heading text-2xl sm:text-3xl">
          {profile.age === "child" ? "Let’s check this together" : "Am I being scammed?"}
        </CardTitle>
        <Progress value={Math.min(100, (askedCount / Math.max(MAX_ASKED, 1)) * 100)} className="pt-2">
          <span className="text-xs text-muted-foreground">
            {showingResults ? "Match ready" : `${askedCount} answered`}
          </span>
        </Progress>
      </CardHeader>
      <CardContent className="space-y-5">
        {!showingResults && current ? (
          <div className="space-y-4">
            <p className="text-lg font-medium leading-snug sm:text-xl">{current.prompt}</p>
            {current.helper ? (
              <p className="text-sm text-muted-foreground sm:text-base">{current.helper}</p>
            ) : null}

            {current.kind === "text" || current.kind === "upload" ? (
              <div className="space-y-3">
                {current.kind === "upload" ? (
                  <label className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30">
                    <span className="font-medium text-foreground">Attach a text export</span>
                    <span>
                      {fileName ? `Selected: ${fileName}` : "WhatsApp/Telegram exports, .txt, or .csv."}
                    </span>
                    <input
                      type="file"
                      className="sr-only"
                      accept=".txt,.csv,.json,.html,.md,.log,text/plain"
                      onChange={(event) => void onFile(event.target.files?.[0])}
                    />
                  </label>
                ) : null}
                <Textarea
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder={
                    current.kind === "upload"
                      ? "Or paste the conversation here…"
                      : "They said they were from my bank and wanted Apple gift cards…"
                  }
                  rows={4}
                />
                {fileError ? <p className="text-sm text-destructive">{fileError}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="lg"
                    onClick={() =>
                      current.kind === "upload"
                        ? answerQuestion(current.id, details.trim())
                        : submitDetails()
                    }
                  >
                    {current.kind === "upload" ? "Continue" : "See matches"}
                  </Button>
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={() => answerQuestion(current.id, SKIP, current.kind === "text")}
                  >
                    Skip
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  {(current.kind === "yesno" ? YESNO_OPTIONS : current.options ?? []).map(
                    (option) => (
                      <button
                        key={option.id}
                        type="button"
                        className={cn(
                          buttonVariants({ variant: "outline", size: "lg" }),
                          "h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left"
                        )}
                        onClick={() => answerQuestion(current.id, option.id)}
                      >
                        {option.label}
                      </button>
                    )
                  )}
                </div>
                <Button variant="ghost" className="px-0 text-muted-foreground" onClick={skipCurrent}>
                  Skip
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {askedCount > 0 ? (
                <Button variant="ghost" onClick={goBack}>
                  Back
                </Button>
              ) : null}
              {askedCount > 0 ? (
                <Button variant="ghost" onClick={() => answerQuestion("details", details, true)}>
                  Show matches now
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl">
                {profile.simplified ? "Closest match" : "Likely matches"}
              </h3>
            </div>
            <RankedList ranked={ranked.slice(0, resultLimit(profile))} />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => void confirmMatch()} disabled={confirming}>
                {confirming
                  ? "Saving…"
                  : confirmed && !confirmError
                    ? "Reported"
                    : "This is what happened to me"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/results")}>
                Full results
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/report")}>
                Report a different scam
              </Button>
              <Button size="lg" variant="ghost" onClick={reset}>
                Start over
              </Button>
            </div>
            {confirmMessage ? (
              <p className={`text-sm ${confirmError ? "text-destructive" : "text-muted-foreground"}`}>
                {confirmMessage}
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
