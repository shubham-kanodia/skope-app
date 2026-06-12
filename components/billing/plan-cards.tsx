"use client";

import { useState } from "react";
import { grantPlan } from "@/app/dashboard/billing/actions";
import { track } from "@/lib/analytics/gtag";
import type { OrgPlan } from "@/lib/entitlement";

export interface PlanCardData {
  plan: OrgPlan;
  label: string;
  priceLabel: string;
  features: string[];
  current: boolean;
}

export function PlanCards({
  cards,
  isOwner,
  paused = false,
}: {
  cards: PlanCardData[];
  isOwner: boolean;
  /** Payments paused (launch period): show plans for reference, no buy buttons. */
  paused?: boolean;
}) {
  const [busy, setBusy] = useState<OrgPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function choose(plan: OrgPlan) {
    if (plan === "free") return;
    setBusy(plan);
    setNote(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "Couldn't start checkout.");
      } else if (data.configured === false) {
        // Payments not live yet, owners can switch manually for now.
        if (isOwner) {
          const g = await grantPlan(plan);
          if (!g.error) track("plan_granted", { plan });
          setNote(g.error ?? "Plan updated. Payments go live soon, no charge for now.");
        } else {
          setNote("Payments go live soon. Ask the owner to switch plans.");
        }
      } else {
        // configured: a real Razorpay order, the checkout widget would open here.
        track("begin_checkout", { currency: "INR", value: data.amount / 100, plan });
        setNote("Opening checkout…");
      }
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.plan}
            className={`flex flex-col rounded-2xl border p-5 ${c.current ? "border-primary" : "border-hairline"}`}
          >
            <div className="flex items-center justify-between">
              <p className="font-medium text-ink">{c.label}</p>
              {c.current && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Current</span>
              )}
            </div>
            <p className="mt-1 text-2xl text-ink">
              {c.priceLabel}
              {c.plan !== "free" && <span className="text-sm text-muted"> /mo</span>}
            </p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-body">
              {c.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {!paused && !c.current && c.plan !== "free" && (
              <button
                onClick={() => choose(c.plan)}
                disabled={busy !== null}
                className="mt-5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-active disabled:opacity-60"
              >
                {busy === c.plan ? "…" : `Choose ${c.label}`}
              </button>
            )}
          </div>
        ))}
      </div>
      {note && <p className="mt-3 text-sm text-ink">{note}</p>}
    </div>
  );
}
