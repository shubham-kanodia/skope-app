"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

/** Razorpay's checkout widget, injected via their script tag. */
interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}
interface RazorpayFailure {
  error?: { description?: string; reason?: string };
}
interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: RazorpayFailure) => void) => void;
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PlanCards({ cards, isOwner }: { cards: PlanCardData[]; isOwner: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<OrgPlan | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function choose(plan: OrgPlan) {
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
        // Keys not set yet: owners can switch manually as a fallback.
        if (isOwner) {
          const g = await grantPlan(plan);
          if (!g.error) track("plan_granted", { plan });
          setNote(g.error ?? "Plan updated.");
          if (!g.error) router.refresh();
        } else {
          setNote("Ask the owner to change plans.");
        }
      } else {
        track("begin_checkout", { currency: "INR", value: data.amount / 100, plan });
        await openCheckout(data);
      }
    } catch {
      setNote("Network error. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function openCheckout(data: { orderId: string; keyId: string; amount: number; plan: OrgPlan }) {
    const ready = await loadRazorpay();
    if (!ready || !window.Razorpay) {
      setNote("Couldn't load checkout. Check your connection and try again.");
      return;
    }
    const label = cards.find((c) => c.plan === data.plan)?.label ?? data.plan;
    const rzp = new window.Razorpay({
      key: data.keyId,
      order_id: data.orderId,
      amount: data.amount,
      currency: "INR",
      name: "Skope",
      description: `${label} plan`,
      theme: { color: "#4f46e5" },
      handler: (r) => {
        void verifyPayment(r, data.plan);
      },
      modal: { ondismiss: () => setNote("Checkout cancelled.") },
    });
    rzp.on("payment.failed", (response) => {
      setNote(response.error?.description ?? "Payment failed. No charge was made, please try again.");
    });
    rzp.open();
  }

  async function verifyPayment(
    r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string },
    plan: OrgPlan,
  ) {
    setNote("Confirming payment…");
    try {
      const res = await fetch("/api/billing/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, plan }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNote(data.error ?? "We couldn't confirm the payment. If you were charged, it'll activate shortly.");
        return;
      }
      track("purchase", { currency: "INR", plan });
      setNote("Payment confirmed. Your plan is active.");
      router.refresh();
    } catch {
      setNote("Payment received but confirmation failed. It'll activate shortly.");
    }
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
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
              <span className="text-sm text-muted"> /mo</span>
            </p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-body">
              {c.features.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
            {!c.current && (
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
