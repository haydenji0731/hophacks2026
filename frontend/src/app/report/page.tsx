import { ReportForm } from "@/components/report-form";

export const metadata = {
  title: "Report a scam",
  description: "Describe a new or more specific scam pattern.",
};

export default function ReportPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Contribute
        </p>
        <h1 className="font-heading text-4xl tracking-tight">Report a scam</h1>
        <p className="max-w-2xl text-muted-foreground">
          Use this when the check did not have your pattern, or you want to add
          a more specific version. Notes stay on this device.
        </p>
      </div>
      <ReportForm />
    </div>
  );
}
