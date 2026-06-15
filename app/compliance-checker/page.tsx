import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { ComplianceChecker } from "./checker";

export const metadata: Metadata = {
  title: "DPDP compliance checker, Skope",
  description:
    "Scan your website and see if it's ready for India's Digital Personal Data Protection Act. Free, in about a minute.",
  robots: { index: true, follow: true },
};

export default function Page() {
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

      <div className="mx-auto max-w-3xl px-6 py-14">
        <p className="font-mono text-xs tracking-tight text-amber">DPDP RULES ARE LIVE</p>
        <h1 className="mt-3 text-[2.5rem] leading-tight">Is your site DPDP-ready?</h1>
        <p className="mt-3 max-w-xl text-body">
          Enter your domain. We check your homepage for consent, trackers, a privacy notice, and
          more, then score your readiness against India&apos;s Digital Personal Data Protection Act.
        </p>
        <div className="mt-8">
          <ComplianceChecker />
        </div>
      </div>
    </main>
  );
}
