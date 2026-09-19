"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { findScam, SCAMS } from "@/lib/survey/engine";
import { loadReports, saveReport } from "@/lib/survey/reports";

const FEATURED = [
  { id: "e_dating_money_request", label: "E-dating / romance money request" },
  { id: "cashier_check_overpayment", label: "Cashier’s-check overpayment" },
  { id: "irs_ssa_tax_impersonation", label: "IRS / tax / government call" },
  { id: "tech_support_remote_access", label: "Fake tech support" },
  { id: "job_offer_training_equipment_fee", label: "Job that asks you to pay" },
  { id: "new", label: "Something we don’t list yet" },
];

const CHANNELS = [
  { id: "phone", label: "Phone call" },
  { id: "sms", label: "Text" },
  { id: "chat", label: "WhatsApp / Telegram / dating app" },
  { id: "web", label: "Website, email, or social" },
  { id: "other", label: "Something else" },
];

const DEMANDS = [
  { id: "gift_card", label: "Gift cards" },
  { id: "wire", label: "Wire" },
  { id: "crypto", label: "Crypto" },
  { id: "cash", label: "Cash or payment app" },
  { id: "check", label: "Cashier’s check or money order" },
  { id: "none", label: "They wanted logins or access, not money" },
];

export function ReportForm() {
  const [pattern, setPattern] = useState("");
  const [channel, setChannel] = useState("");
  const [demand, setDemand] = useState("");
  const [notes, setNotes] = useState("");
  const [evidenceName, setEvidenceName] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [reports, setReports] = useState<ReturnType<typeof loadReports>>([]);

  const known = FEATURED.filter((item) => item.id !== "new");
  const extra = useMemo(
    () =>
      SCAMS.filter(
        (scam) => !known.some((item) => item.id === scam.slug) && scam.frequency >= 16
      ).slice(0, 8),
    [known]
  );

  function submit() {
    const label =
      FEATURED.find((item) => item.id === pattern)?.label ||
      findScam(pattern)?.name ||
      "New / unlabeled";
    const entry = saveReport({
      pattern: pattern || "new",
      patternLabel: label,
      channel: channel || "skip",
      demand: demand || "skip",
      notes: notes.trim(),
      evidenceName,
    });
    setSavedId(entry.id);
    setReports(loadReports());
  }

  if (savedId) {
    const match = findScam(pattern);
    return (
      <div className="space-y-5">
        <h2 className="font-heading text-2xl">Saved on this device</h2>
        <p className="text-muted-foreground">
          Nothing was uploaded. When the clean-and-upsert loop is live, reports like this
          teach the encyclopedia. You can keep a copy of the notes yourself.
        </p>
        {match ? (
          <p>
            Closest listed pattern:{" "}
            <Link href={`/scams/${match.slug}`} className="text-primary hover:underline">
              {match.name}
            </Link>
          </p>
        ) : (
          <p className="text-muted-foreground">
            Marked as a new pattern. We will review notes like this before adding a public page.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button size="lg" render={<Link href={`/#survey`} />}>
            Back to the check
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => {
              setSavedId(null);
              setNotes("");
              setEvidenceName("");
            }}
          >
            Submit another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <fieldset className="space-y-3">
        <legend className="text-lg font-medium">Which is closest?</legend>
        <p className="text-sm text-muted-foreground">Skip any question. E-dating and cashier’s-check overpay are listed first because people ask for them by name.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {FEATURED.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="lg"
              variant={pattern === item.id ? "default" : "outline"}
              className="h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left"
              onClick={() => setPattern(item.id)}
            >
              {item.label}
            </Button>
          ))}
          {extra.map((scam) => (
            <Button
              key={scam.slug}
              type="button"
              size="lg"
              variant={pattern === scam.slug ? "default" : "outline"}
              className="h-auto min-h-12 justify-start whitespace-normal px-4 py-3 text-left"
              onClick={() => setPattern(scam.slug)}
            >
              {scam.name}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="px-0" onClick={() => setPattern("new")}>
          Skip — I will describe it instead
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-medium">How did they contact you?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CHANNELS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="lg"
              variant={channel === item.id ? "default" : "outline"}
              className="h-auto justify-start px-4 py-3"
              onClick={() => setChannel(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="px-0" onClick={() => setChannel("skip")}>
          Skip this question
        </Button>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-lg font-medium">What did they want?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DEMANDS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="lg"
              variant={demand === item.id ? "default" : "outline"}
              className="h-auto justify-start px-4 py-3"
              onClick={() => setDemand(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <Button type="button" variant="ghost" className="px-0" onClick={() => setDemand("skip")}>
          Skip this question
        </Button>
      </fieldset>

      <label className="block space-y-2">
        <span className="text-lg font-medium">What happened?</span>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          rows={5}
          placeholder="They moved me off Hinge to WhatsApp, said they were overseas, and asked me to cash a check…"
        />
      </label>

      <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Attach a text export (optional)</span>
        <span>
          {evidenceName
            ? `${evidenceName} — kept on this device only.`
            : "Not required. Screenshots are not uploaded; paste text above instead."}
        </span>
        <Input
          type="file"
          accept=".txt,.csv,.json,.html,.md,.log,text/plain"
          className="cursor-pointer"
          onChange={(event) => setEvidenceName(event.target.files?.[0]?.name ?? "")}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button size="lg" type="submit">
          Save this report
        </Button>
        <Button size="lg" variant="ghost" render={<Link href="/#survey" />}>
          Cancel
        </Button>
      </div>

      {reports.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {reports.length} report{reports.length === 1 ? "" : "s"} stored in this browser.
        </p>
      ) : null}
    </form>
  );
}
