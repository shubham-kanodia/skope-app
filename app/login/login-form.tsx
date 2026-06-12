"use client";

import { useState } from "react";
import { track } from "@/lib/analytics/gtag";

export function LoginForm({
  refCode = null,
  fixedEmail,
}: {
  refCode?: string | null;
  /** When set, the email is pre-filled and locked (used by the invite flow). */
  fixedEmail?: string;
}) {
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ref: refCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong. Try again.");
        return;
      }
      setState("sent");
      track("login_link_requested", { has_ref: !!refCode, is_invite: !!fixedEmail });
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Check your connection and try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-hairline border-l-2 border-l-primary bg-surface-soft px-5 py-5">
        <p className="font-medium text-ink">Check your email.</p>
        <p className="mt-1 text-sm text-body">
          We sent a sign-in link to <span className="text-ink">{email}</span>. It
          works once and expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <label htmlFor="email" className="block text-sm font-medium text-ink">
        Work email
      </label>
      <input
        id="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@yourstore.in"
        readOnly={!!fixedEmail}
        className="w-full rounded-xl border border-hairline bg-canvas px-4 py-3 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 read-only:bg-surface-soft"
      />
      {message && <p className="text-sm text-ink">{message}</p>}
      <button
        type="submit"
        disabled={state === "sending"}
        className="w-full rounded-full bg-primary px-5 py-3 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
      >
        {state === "sending" ? "Sending link…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
