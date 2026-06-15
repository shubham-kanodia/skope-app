import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/ui/logo";
import { ScoreRing, StatusIcon, BAND_META } from "@/components/scan/score";
import { getScanByToken } from "@/lib/scan/store";

export const metadata: Metadata = {
  title: "Your DPDP compliance report, Skope",
  robots: { index: false, follow: false },
};

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });

export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getScanByToken(token);
  if (!data) notFound();

  const r = data.report;
  const meta = BAND_META[r.band];

  return (
    <main className="min-h-screen">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <Link href="/compliance-checker" aria-label="Skope">
            <Logo />
          </Link>
          <Link href="/login" className="text-sm font-medium text-primary hover:text-primary-active">
            Get compliant →
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-12">
        <p className="text-sm text-muted">DPDP compliance report</p>
        <h1 className="mt-1 text-[2rem] leading-tight">{r.domain}</h1>
        <p className="mt-1 text-sm text-muted">Scanned {when.format(new Date(r.scannedAt))} (IST)</p>

        <div className="mt-8 flex flex-col items-center gap-6 rounded-3xl border border-hairline p-8 sm:flex-row sm:gap-8">
          <ScoreRing score={r.score} band={r.band} />
          <div>
            <p className="font-mono text-sm" style={{ color: meta.color }}>
              {meta.label.toUpperCase()}
            </p>
            <p className="mt-1 max-w-md text-body">
              Your readiness score weighs consent, trackers, a privacy notice, a grievance contact,
              and language support. Here&apos;s each check and how to close it.
            </p>
          </div>
        </div>

        <div className="mt-8 space-y-3">
          {r.findings.map((f) => (
            <div key={f.id} className="flex gap-3 rounded-2xl border border-hairline px-5 py-4">
              <StatusIcon status={f.status} />
              <div>
                <p className="font-medium text-ink">{f.title}</p>
                <p className="mt-0.5 text-sm text-body">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {r.trackers.length > 0 && (
          <div className="mt-6 rounded-2xl border border-hairline p-5">
            <p className="text-sm font-medium text-ink">Trackers we found</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {r.trackers.map((t) => (
                <span key={t.name} className="rounded-full bg-surface-strong px-3 py-1 text-xs text-body">
                  {t.name} · {t.category}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-10 rounded-3xl bg-surface-dark p-8 text-center">
          <h2 className="text-2xl text-white">Fix all of this in about 30 minutes</h2>
          <p className="mx-auto mt-2 max-w-md text-on-dark-soft">
            Skope adds a DPDP consent banner, blocks trackers until consent, and keeps audit-ready
            records, from one script tag.
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-full bg-primary px-6 py-3 font-medium text-white hover:bg-primary-active"
          >
            Get compliant with Skope
          </Link>
        </div>

        <p className="mt-8 text-center text-xs text-muted">
          This automated check looks at your homepage only and isn&apos;t legal advice.
        </p>
      </div>
    </main>
  );
}
