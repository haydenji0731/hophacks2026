import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { findScam, SCAMS } from "@/lib/survey/engine";

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
        <h1 className="font-heading text-4xl tracking-tight text-balance">{scam.name}</h1>
        <p className="max-w-2xl text-lg text-muted-foreground">{scam.description}</p>
      </div>

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
