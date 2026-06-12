import Link from "next/link";

/** Minimal chrome for Skope-hosted, end-user-facing pages (privacy, preferences). */
export function PublicShell({
  orgName,
  domain,
  children,
}: {
  orgName: string;
  domain: string;
  children: React.ReactNode;
}) {
  const homeHref = domain.startsWith("http") ? domain : `https://${domain}`;
  return (
    <main className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <a href={homeHref} className="text-sm font-medium text-ink hover:text-primary">
            {orgName}
          </a>
          <span className="text-xs text-muted">{domain}</span>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-6 py-12">{children}</div>
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6 text-xs text-muted">
          <span>Consent and privacy tools by Skope</span>
          <Link href="/" className="hover:text-ink">
            skope.network
          </Link>
        </div>
      </footer>
    </main>
  );
}

/** Render a notice body (blank-line-separated paragraphs) as paragraphs. */
export function Prose({ text }: { text: string }) {
  const paras = text.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <div className="space-y-3">
      {paras.map((p, i) => (
        <p key={i} className="whitespace-pre-line text-body">
          {p}
        </p>
      ))}
    </div>
  );
}
