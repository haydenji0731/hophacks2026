import Link from "next/link";

const links = [
  { href: "/#survey", label: "Am I being scammed?" },
  { href: "/scams", label: "Scam repository" },
  { href: "/report", label: "Report a scam" },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border/80 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="font-heading text-lg tracking-tight sm:text-xl">
          We<span className="text-primary">Hate</span>Scammers
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3 text-sm text-muted-foreground sm:gap-5">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
