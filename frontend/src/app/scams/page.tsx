"use client";

import { useMemo, useState } from "react";
import { ScamCard } from "@/components/scam-card";
import { Input } from "@/components/ui/input";
import { SCAMS, searchScams } from "@/lib/survey/engine";

export default function ScamsPage() {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchScams(query), [query]);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Encyclopedia
        </p>
        <h1 className="font-heading text-4xl tracking-tight">
          Scam repository
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          {SCAMS.length} patterns: r/Scams reports (Jun–Sep 2026) plus a 60-method
          catalog from Grok Bot (merged, not duplicated). Each row is a type, not
          a single incident. Search by channel, demand, or a phrase they used.
        </p>
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search gift cards, IRS, WhatsApp, marketplace…"
        type="search"
        aria-label="Search scam patterns"
      />

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nothing matched “{query}”. Try a platform, a payment type, or a
          shorter phrase.
        </div>
      ) : (
        <ul className="space-y-4">
          {results.map((scam) => (
            <li key={scam.id}>
              <ScamCard scam={scam} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
