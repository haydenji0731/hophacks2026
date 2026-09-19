import Link from "next/link";
import { SurveyBox } from "@/components/survey-box";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-5 pt-6 text-center sm:pt-10">
        <p className="text-xs font-medium tracking-[0.28em] text-primary uppercase">
          We hate scammers
        </p>
        <h1 className="font-heading text-4xl leading-[1.05] tracking-tight text-balance sm:text-6xl md:text-7xl">
          And If You&apos;re Here, You Probably Do Too
        </h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
          Answer a few questions. We rank the scam patterns that fit what just
          happened.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" render={<Link href="#survey" />}>
            Start the check
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/scams" />}>
            Browse the repository
          </Button>
          <Button size="lg" variant="outline" render={<Link href="/report" />}>
            Report a scam
          </Button>
        </div>
      </section>

      <SurveyBox />
    </div>
  );
}
