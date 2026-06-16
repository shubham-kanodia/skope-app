"use client";

import { useState } from "react";
import { ScoreRing, StatusIcon, BAND_META, type Band } from "@/components/scan/score";
import type { FindingStatus } from "@/lib/scan/analyze";

interface ScanResult {
  token: string;
  domain: string;
  score: number;
  band: Band;
  trackerCount: number;
  checks: { title: string; status: FindingStatus }[];
}

export function ComplianceChecker() {
  const [domain, setDomain] = useState("");
  const [phase, setPhase] = useState<"input" | "scanning" | "results">("input");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);

  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  async function scan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase("scanning");
    try {
      const res = await fetch("/api/compliance/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We couldn't scan that site.");
        setPhase("input");
        return;
      }
      setResult(data as ScanResult);
      setPhase("results");
    } catch {
      setError("We couldn't reach the scanner. Try again.");
      setPhase("input");
    }
  }

  async function sendReport(e: React.FormEvent) {
    e.preventDefault();
    if (!result) return;
    setEmailState("sending");
    setEmailMsg(null);
    try {
      const res = await fetch("/api/compliance/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: result.token, email }),
      });
      const data = await res.json();
      if (data.url) setReportUrl(data.url);
      if (!res.ok && !data.url) {
        setEmailState("error");
        setEmailMsg(data.error ?? "Something went wrong.");
        return;
      }
      setEmailState("sent");
      setEmailMsg(data.error ?? null); // e.g. "couldn't email, open here instead"
    } catch {
      setEmailState("error");
      setEmailMsg("Network error. Try again.");
    }
  }

  if (phase !== "results" || !result) {
    return (
      <form onSubmit={scan} className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            required
            value={domain}
            onChange={(e) => { setDomain(e.target.value); setError(null); }}
            placeholder="yourstore.in"
            className="flex-1 rounded-xl border border-hairline bg-canvas px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            disabled={phase === "scanning"}
            className="rounded-full bg-primary px-6 py-3 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
          >
            {phase === "scanning" ? "Scanning…" : "Check my site"}
          </button>
        </div>
        {error && <p className="text-sm text-ink">{error}</p>}
        <p className="text-sm text-muted">
          We check your homepage only.
        </p>
      </form>
    );
  }

  const meta = BAND_META[result.band];

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center gap-4 rounded-3xl border border-hairline p-8 sm:flex-row sm:items-center sm:gap-8">
        <ScoreRing score={result.score} band={result.band} />
        <div>
          <p className="font-mono text-sm" style={{ color: meta.color }}>{meta.label.toUpperCase()}</p>
          <h2 className="mt-1 text-2xl text-ink">{result.domain}</h2>
          <p className="mt-1 text-body">
            {result.band === "on_track"
              ? "You're close. A few gaps to close before you're fully DPDP-ready."
              : result.band === "needs_work"
                ? "There are real gaps between your site and DPDP. The good news: they're fixable."
                : "Your site isn't set up for DPDP yet. Here's what to fix."}
          </p>
        </div>
      </div>

      <ul className="space-y-3">
        {result.checks.map((c) => (
          <li key={c.title} className="flex items-start gap-3 rounded-2xl border border-hairline px-4 py-3">
            <StatusIcon status={c.status} />
            <span className="text-ink">{c.title}</span>
          </li>
        ))}
      </ul>

      {/* Email gate for the full report */}
      <div className="rounded-3xl border border-hairline border-l-2 border-l-primary bg-surface-soft p-6">
        {emailState === "sent" ? (
          <div>
            <p className="font-medium text-ink">
              {emailMsg ? "Your report is ready." : "Check your email."}
            </p>
            <p className="mt-1 text-sm text-body">
              {emailMsg ?? `We sent the full report for ${result.domain}, with how to fix each gap.`}
            </p>
            {reportUrl && (
              <a href={reportUrl} className="mt-2 inline-block text-sm font-medium text-primary hover:text-primary-active">
                Open your report →
              </a>
            )}
          </div>
        ) : (
          <form onSubmit={sendReport}>
            <p className="font-medium text-ink">Get the full report, with fixes</p>
            <p className="mt-1 mb-3 text-sm text-body">
              We&apos;ll email you a detailed report: every gap, why it matters under DPDP, and how to close it.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setEmailMsg(null); }}
                placeholder="you@yourstore.in"
                className="flex-1 rounded-xl border border-hairline bg-canvas px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <button
                type="submit"
                disabled={emailState === "sending"}
                className="rounded-full bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
              >
                {emailState === "sending" ? "Sending…" : "Email me the report"}
              </button>
            </div>
            {emailState === "error" && emailMsg && <p className="mt-2 text-sm text-ink">{emailMsg}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
