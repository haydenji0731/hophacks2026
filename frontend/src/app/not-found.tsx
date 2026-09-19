import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="space-y-4 py-10">
      <h1 className="font-heading text-4xl">Page not found</h1>
      <p className="text-muted-foreground">
        That route is not in this build. Head back to the check or the
        repository.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="lg" render={<Link href="/" />}>
          Front page
        </Button>
        <Button size="lg" variant="outline" render={<Link href="/scams" />}>
          Scam repository
        </Button>
      </div>
    </div>
  );
}
