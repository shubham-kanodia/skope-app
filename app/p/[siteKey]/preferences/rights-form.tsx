"use client";

import { useState } from "react";

const TYPES: { value: string; label: string; hint: string }[] = [
  { value: "access", label: "Access my data", hint: "A summary of the personal data held about you and how it's processed." },
  { value: "correction", label: "Correct my data", hint: "Fix data that's inaccurate or out of date." },
  { value: "erasure", label: "Erase my data", hint: "Delete data that's no longer needed." },
  { value: "nomination", label: "Nominate someone", hint: "Let another person exercise your rights on your behalf." },
  { value: "grievance", label: "Raise a grievance", hint: "Report a concern about how your data is handled." },
];

export function RightsForm({ siteKey }: { siteKey: string }) {
  const [type, setType] = useState("access");
  const [email, setEmail] = useState("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const activeHint = TYPES.find((t) => t.value === type)?.hint;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setMessage(null);
    try {
      const res = await fetch("/api/v1/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteKey, type, email, detail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState("error");
        setMessage(data.error ?? "Something went wrong.");
        return;
      }
      setState("sent");
    } catch {
      setState("error");
      setMessage("We couldn't reach the server. Try again.");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-2xl border border-hairline border-l-2 border-l-primary bg-surface-soft px-5 py-5">
        <p className="font-medium text-ink">Check your email.</p>
        <p className="mt-1 text-sm text-body">
          We sent a confirmation link to <span className="text-ink">{email}</span>. Open it to
          confirm your request, then we&apos;ll get to work on it.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">What would you like to do?</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
        {activeHint && <p className="mt-1.5 text-[13px] text-muted">{activeHint}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Your email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <p className="mt-1.5 text-[13px] text-muted">We email you a link to confirm it&apos;s really you.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Details (optional)</label>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
          placeholder="Anything that helps us handle your request."
          className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-4 py-2.5 text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {state === "error" && message && <p className="text-sm text-ink">{message}</p>}

      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-full bg-primary px-6 py-2.5 font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Submit request"}
      </button>
    </form>
  );
}
