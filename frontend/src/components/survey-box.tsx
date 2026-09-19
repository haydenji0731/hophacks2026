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
import { nextSteps, profileFromAnswers, resultLimit } from "@/lib/survey/profile";
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
      reason: "We cannot read screenshots or PDFs on this device. Paste a few lines of the chat instead.",
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
  const liveTop = ranked.slice(0, 3);
  const typeScale = profile.simplified ? "text-xl sm:text-2xl" : "text-lg";

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
    answerQuestion(current.id, SKIP, current.kind === "text" || current.kind === "upload" && done);
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
    <Card
      id="survey"
      className={`relative scroll-mt-24 border-primary/25 bg-card/90 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] ${
        profile.simplified ? "text-lg" : ""
      }`}
    >
      <div className="pointer-events-none absolute -top-3 left-6 rounded-full border border-primary/40 bg-background px-3 py-0.5 text-[11px] font-medium tracking-[0.18em] text-primary uppercase">
        Survey
      </div>
      <CardHeader className="pt-6">
        <CardTitle className="font-heading text-2xl sm:text-3xl">
          {profile.age === "child" ? "Let’s check this together" : "Am I being scammed?"}
        </CardTitle>
        <p className="text-sm text-muted-foreground sm:text-base">
          {profile.arrival === "phone"
            ? "You were told to hang up and come here. Every question can be skipped."
            : profile.arrival === "extension"
              ? "You can paste the chat if you want — you do not have to. Every question can be skipped."
              : "A few questions against known scam patterns. Skip anything you do not want to answer."}
        </p>
        <Progress value={Math.min(100, (askedCount / Math.max(MAX_ASKED, 1)) * 100)} className="pt-2">
          <span className="text-xs text-muted-foreground">
            {showingResults ? "Match ready" : `${askedCount} answered · skip anytime`}
          </span>
        </Progress>
      </CardHeader>
      <CardContent className="space-y-5">
        {!showingResults && current ? (
          <div className="space-y-4">
            <p className={`${typeScale} font-medium leading-snug`}>{current.prompt}</p>
            {current.helper ? (
              <p className="text-sm text-muted-foreground sm:text-base">{current.helper}</p>
            ) : null}

            {current.kind === "text" || current.kind === "upload" ? (
              <div className="space-y-3">
                {current.kind === "upload" ? (
                  <label className="flex cursor-pointer flex-col items-start gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary/50 hover:bg-muted/30">
                    <span className="font-medium text-foreground">
                      Attach a text export (optional)
                    </span>
                    <span>
                      {fileName
                        ? `Selected: ${fileName}. It stays on this device.`
                        : "WhatsApp/Telegram exports, .txt, or .csv. Not required."}
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
                  className={profile.simplified ? "min-h-28 text-lg" : ""}
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
                    onClick={() =>
                      answerQuestion(current.id, SKIP, current.kind === "text")
                    }
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
                          "h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left",
                          profile.simplified ? "text-base sm:text-lg" : ""
                        )}
                        onClick={() => answerQuestion(current.id, option.id)}
                      >
                        {option.label}
                      </button>
                    )
                  )}
                </div>
                <Button variant="ghost" className="px-0" onClick={skipCurrent}>
                  Skip this question
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
                <Button
                  variant="ghost"
                  onClick={() => answerQuestion("details", details, true)}
                >
                  Show matches now
                </Button>
              ) : null}
            </div>

            {askedCount > 0 && !profile.simplified ? (
              <p className="text-xs text-muted-foreground">
                Leading so far: {liveTop.map((row) => row.scam.name).join(" · ")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl">
                {profile.simplified ? "This looks like the match" : "Most likely match"}
              </h3>
              <p className="text-sm text-muted-foreground sm:text-base">
                {profile.simplified
                  ? "Read the example and the next steps. If it does not sound right, skip down to report a different scam."
                  : "Ranked from your answers plus how often each pattern showed up. This is a triage, not a verdict."}
              </p>
            </div>
            <RankedList
              ranked={ranked.slice(0, resultLimit(profile))}
              simplified={profile.simplified}
              nextStepsFor={(scam) => nextSteps(scam, profile)}
            />
            <div className="flex flex-wrap gap-2">
              <Button size="lg" onClick={() => void confirmMatch()} disabled={confirming}>
                {confirming
                  ? "Saving…"
                  : confirmed && !confirmError
                    ? "Reported"
                    : "This is what happened to me"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => router.push("/results")}>
                {profile.simplified ? "See more detail" : "Open full results"}
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
                {confirmMessage} On-device copy is still saved in this browser.
              </p>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
