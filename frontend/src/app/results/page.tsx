"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { RankedList } from "@/components/scam-card";
import { Button } from "@/components/ui/button";
import { nextSteps, profileFromAnswers, resultLimit } from "@/lib/survey/profile";
import { loadSurvey } from "@/lib/survey/session";
import type { SurveySnapshot } from "@/lib/survey/types";

function subscribe() {
  return () => {};
}

function getSnapshot(): SurveySnapshot | null {
  return loadSurvey();
}

export default function ResultsPage() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => null);

  if (!snapshot || snapshot.answers.length === 0) {
    return (
      <div className="space-y-5">
        <h1 className="font-heading text-4xl">Your results</h1>
        <p className="max-w-xl text-muted-foreground">
          No survey answers in this session yet. Run the check on the front page
          and we will keep the ranking here so you can share or iterate.
        </p>
        <Button size="lg" render={<Link href="/#survey" />}>
          Start the check
        </Button>
      </div>
    );
  }

  const profile = profileFromAnswers(snapshot.answers);

  return (
    <div className={`space-y-6 ${profile.simplified ? "text-lg" : ""}`}>
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Results
        </p>
        <h1 className="font-heading text-4xl tracking-tight">
          {profile.simplified ? "Your match" : "Most likely matches"}
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {profile.simplified
            ? "Here is the closest pattern, an example, and what to do now."
            : `Ranked from ${snapshot.answers.length} answer${
                snapshot.answers.length === 1 ? "" : "s"
              }. Open a pattern for examples and next steps.`}
        </p>
      </div>
      <RankedList
        ranked={snapshot.ranked.slice(0, resultLimit(profile) === 1 ? 1 : 6)}
        simplified={profile.simplified}
        nextStepsFor={(scam) => nextSteps(scam, profile)}
      />
      <div className="flex flex-wrap gap-2">
        <Button size="lg" render={<Link href="/#survey" />}>
          Change answers
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/report" />}>
          Report a different scam
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/scams" />}>
          Browse the repository
        </Button>
      </div>
    </div>
  );
}
