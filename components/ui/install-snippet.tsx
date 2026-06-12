"use client";

import { useState } from "react";

/** Mono terminal-style card with a copy button, the install one-liner. */
export function InstallSnippet({ siteKey }: { siteKey: string }) {
  const [copied, setCopied] = useState(false);
  const cdn = process.env.NEXT_PUBLIC_CDN_URL ?? "https://cdn.skope.network";
  const snippet = `<script src="${cdn}/skope.js" data-site="${siteKey}" defer></script>`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked, the user can still select the text */
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface-dark px-4 py-3">
      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-on-dark-soft">
        {snippet}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-full bg-elevated px-3 py-1.5 text-xs font-medium text-white hover:bg-elevated-2"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
