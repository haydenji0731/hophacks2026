import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { demandLabel, frequencyLabel, percent, platformLabel } from "@/lib/survey/format";
import type { RankedScam, Scam } from "@/lib/survey/types";

export function ScamCard({
  scam,
  confidence,
  reasons,
  href,
  simplified = false,
  nextSteps,
}: {
  scam: Scam;
  confidence?: number;
  reasons?: string[];
  href?: string;
  simplified?: boolean;
  nextSteps?: string[];
}) {
  const target = href ?? `/scams/${scam.slug}`;
  const steps = nextSteps ?? (simplified ? scam.simpleWhatToDo : scam.whatToDo);
  const examples = scam.examples ?? [];

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className={`font-heading leading-tight ${simplified ? "text-2xl" : "text-xl"}`}>
            <Link href={target} className="hover:text-primary">
              {scam.name}
            </Link>
          </CardTitle>
          {simplified ? null : confidence != null ? (
            <Badge variant="secondary">{percent(confidence)} match</Badge>
          ) : (
            <Badge variant="outline">{frequencyLabel(scam)}</Badge>
          )}
        </div>
        {simplified ? null : (
          <div className="flex flex-wrap gap-1.5">
            {scam.platforms.map((platform) => (
              <Badge key={platform} variant="outline">
                {platformLabel(platform)}
              </Badge>
            ))}
            {scam.demands
              .filter((demand) => demand !== "other")
              .map((demand) => (
                <Badge key={demand} variant="outline">
                  {demandLabel(demand)}
                </Badge>
              ))}
          </div>
        )}
      </CardHeader>
      <CardContent className={`space-y-4 ${simplified ? "text-base sm:text-lg" : "text-sm"} text-muted-foreground`}>
        <p className="text-foreground/90">{scam.description}</p>
        {examples[0] ? (
          <div className="space-y-2">
            <p className="font-medium text-foreground">Example</p>
            <p className="rounded-lg border border-border/70 bg-background/50 px-3 py-2 text-foreground">
              {examples[0]}
            </p>
          </div>
        ) : null}
        {reasons && reasons.length > 0 && !simplified ? (
          <ul className="space-y-1 text-foreground/90">
            {reasons.slice(0, 3).map((reason) => (
              <li key={reason}>— {reason}</li>
            ))}
          </ul>
        ) : null}
        <div className="space-y-2">
          <p className="font-medium text-foreground">Next steps</p>
          <ol className="space-y-2">
            {steps.slice(0, simplified ? 3 : 4).map((step, index) => (
              <li key={step} className="text-foreground/90">
                <span className="mr-2 font-medium text-primary">{index + 1}.</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <Link href={target} className="inline-block font-medium text-primary hover:underline">
          {simplified ? "See more examples" : "How it works, examples, and what to do"}
        </Link>
      </CardContent>
    </Card>
  );
}

export function RankedList({
  ranked,
  empty,
  simplified = false,
  nextStepsFor,
}: {
  ranked: RankedScam[];
  empty?: string;
  simplified?: boolean;
  nextStepsFor?: (scam: Scam) => string[];
}) {
  if (ranked.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {empty ?? "No matching patterns yet."}
      </p>
    );
  }

  const [primary, ...rest] = ranked;

  return (
    <div className="space-y-4">
      <ScamCard
        scam={primary.scam}
        confidence={primary.confidence}
        reasons={primary.reasons}
        simplified={simplified}
        nextSteps={nextStepsFor?.(primary.scam)}
      />
      {rest.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Other close matches</h3>
          {rest.map((row) => (
            <ScamCard
              key={row.scam.id}
              scam={row.scam}
              confidence={row.confidence}
              reasons={row.reasons}
              simplified={simplified}
              nextSteps={nextStepsFor?.(row.scam)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
