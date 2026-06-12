"use client";

import { useState } from "react";

interface VerifyResult {
  live: boolean;
  source: "observed" | "fetched" | "none";
  registeredDomain: string;
  lastSeenAt?: string | null;
  observedOrigin?: string | null;
  observedHost?: string | null;
  domainMatch?: boolean | null;
  error?: string;
}

function ago(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m > 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d > 1 ? "s" : ""} ago`;
}

export function VerifyInstall({
  siteId,
  domain,
  onVerified,
}: {
  siteId: string;
  domain: string;
  /** Called when a check confirms the script is live (drives the setup wizard). */
  onVerified?: () => void;
}) {
  const [url, setUrl] = useState(`https://${domain}`);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [netError, setNetError] = useState<string | null>(null);

  async function check() {
    setChecking(true);
    setResult(null);
    setNetError(null);
    try {
      const res = await fetch("/api/v1/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId, url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNetError(data.error ?? "Couldn't check your site. Try again.");
        return;
      }
      setResult(data as VerifyResult);
      if ((data as VerifyResult).live) onVerified?.();
    } catch {
      setNetError("Network error. Try again.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div>
      <p className="mb-2 text-sm text-body">
        Open your site in a browser and we&apos;ll detect the load automatically, 
        or check a public URL here.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={url}
          onChange={(e) => { setUrl(e.target.value); setResult(null); }}
          className="flex-1 rounded-xl border border-hairline px-3 py-2.5 text-sm text-ink outline-none focus:border-primary"
          placeholder="https://yourstore.in"
        />
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary-active disabled:opacity-60"
        >
          {checking ? "Checking…" : "Check install"}
        </button>
      </div>

      {netError && <p className="mt-3 text-sm text-body">{netError}</p>}

      {result?.live && (
        <div className="mt-3 space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5 text-sm font-medium text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            Live, Skope is installed and running.
          </div>
          {result.source === "observed" && result.observedHost && (
            <p className="text-sm text-body">
              Last load <span className="text-ink">{result.lastSeenAt ? ago(result.lastSeenAt) : ""}</span> on{" "}
              <span className="font-mono text-xs text-ink">{result.observedHost}</span>.
            </p>
          )}
          {result.domainMatch === false && (
            <p className="text-sm text-ink">
              Heads up: it&apos;s running on{" "}
              <span className="font-mono text-xs">{result.observedHost}</span>, which doesn&apos;t match your
              registered domain <span className="font-mono text-xs">{result.registeredDomain}</span>. That&apos;s
              fine for testing, update the domain when you go live.
            </p>
          )}
        </div>
      )}

      {result && !result.live && (
        <p className="mt-3 text-sm text-body">
          {result.error ?? "We haven't seen a load yet. Add the tag, open your site, then check again."}
        </p>
      )}
    </div>
  );
}
