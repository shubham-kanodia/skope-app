"use client";

import { useState } from "react";

export function ReferralCard({
  link,
  count,
  bonusDays,
}: {
  link: string;
  count: number;
  bonusDays: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked, the field is selectable */
    }
  }

  return (
    <div className="rounded-2xl border border-hairline border-l-2 border-l-primary bg-surface-soft p-6">
      <h2 className="text-base text-ink">Refer a friend, you both get a free month</h2>
      <p className="mt-1 text-sm text-body">
        Share your link. New teams get an extra month free on top of their trial, and you get a free
        month added to your plan for each one who signs up.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-xl border border-hairline bg-canvas px-4 py-2.5 font-mono text-sm text-ink outline-none"
        />
        <button
          onClick={copy}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-active"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        {count} referral{count === 1 ? "" : "s"} so far · {bonusDays} bonus day{bonusDays === 1 ? "" : "s"} earned
      </p>
    </div>
  );
}
