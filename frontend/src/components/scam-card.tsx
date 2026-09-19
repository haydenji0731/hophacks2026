import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { percent } from "@/lib/survey/format";
import type { RankedScam, Scam } from "@/lib/survey/types";

export function ScamCard({
  scam,
  confidence,
  href,
}: {
  scam: Scam;
  confidence?: number;
  href?: string;
}) {
  const target = href ?? `/scams/${scam.slug}`;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="gap-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle className="font-heading text-xl leading-tight">
            <Link href={target} className="hover:text-primary">
              {scam.name}
            </Link>
          </CardTitle>
          {confidence != null ? (
            <p className="text-sm text-muted-foreground">{percent(confidence)}</p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-relaxed text-foreground/90">{scam.description}</p>
      </CardContent>
    </Card>
  );
}

export function RankedList({
  ranked,
  empty,
}: {
  ranked: RankedScam[];
  empty?: string;
}) {
  if (ranked.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{empty ?? "No matching patterns yet."}</p>
    );
  }

  const [primary, ...rest] = ranked;

  return (
    <div className="space-y-4">
      <ScamCard scam={primary.scam} confidence={primary.confidence} />
      {rest.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">Also likely</h3>
          {rest.map((row) => (
            <ScamCard key={row.scam.id} scam={row.scam} confidence={row.confidence} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
