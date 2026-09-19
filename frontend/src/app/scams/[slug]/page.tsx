import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { findScam, SCAMS } from "@/lib/survey/engine";
import { demandLabel, frequencyLabel, platformLabel } from "@/lib/survey/format";

export function generateStaticParams() {
  return SCAMS.map((scam) => ({ slug: scam.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scam = findScam(slug);
  if (!scam) return { title: "Scam not found" };
  return {
    title: `${scam.name} · We Hate Scammers`,
    description: scam.description,
  };
}

export default async function ScamDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const scam = findScam(slug);
  if (!scam) notFound();

  return (
    <article className="space-y-8">
      <div className="space-y-3">
        <Link href="/scams" className="text-sm text-muted-foreground hover:text-foreground">
          ← Back to repository
        </Link>
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          {frequencyLabel(scam)}
          {scam.origin === "grok"
            ? " · Grok Bot catalog"
            : scam.origin === "both"
              ? " · Reddit seed + Grok Bot catalog"
              : ""}
        </p>
        <h1 className="font-heading text-4xl tracking-tight text-balance">{scam.name}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{scam.description}</p>
        <div className="flex flex-wrap gap-1.5">
          {scam.platforms.map((platform) => (
            <Badge key={platform} variant="outline">
              {platformLabel(platform)}
            </Badge>
          ))}
          {scam.demands.map((demand) => (
            <Badge key={demand} variant="outline">
              {demandLabel(demand)}
            </Badge>
          ))}
          {scam.victimRoles.map((role) => (
            <Badge key={role} variant="secondary">
              {role}
            </Badge>
          ))}
          {(scam.aliases ?? []).slice(0, 6).map((alias) => (
            <Badge key={alias} variant="outline">
              {alias}
            </Badge>
          ))}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Examples</h2>
        <ul className="space-y-2">
          {(scam.examples ?? []).map((example) => (
            <li
              key={example}
              className="rounded-lg border border-border/70 bg-card/60 px-4 py-3 text-foreground"
            >
              {example}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">How it unfolds</h2>
        <ul className="space-y-2 text-muted-foreground">
          {scam.signals.map((signal) => (
            <li key={signal} className="rounded-lg border border-border/70 bg-card/60 px-4 py-3">
              {signal}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Next steps</h2>
        <ol className="space-y-2">
          {scam.whatToDo.map((step, index) => (
            <li
              key={step}
              className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3"
            >
              <span className="mr-2 font-medium text-primary">{index + 1}.</span>
              {step}
            </li>
          ))}
        </ol>
        <div className="rounded-lg border border-border/70 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">If this is for a child or an older relative</p>
          <ol className="mt-2 space-y-1">
            {scam.simpleWhatToDo.map((step, index) => (
              <li key={step}>
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" render={<Link href="/#survey" />}>
          Check another situation
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/report" />}>
          Report a more specific version
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/scams" />}>
          See nearby patterns
        </Button>
      </div>
    </article>
  );
}
