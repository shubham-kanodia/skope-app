import { getSession } from "@/lib/auth/session";
import { getLimits, PAID_PLANS } from "@/lib/plans";
import { arePaymentsPaused, PAYMENTS_PAUSED_UNTIL, type OrgPlan } from "@/lib/entitlement";

export const runtime = "nodejs";

/**
 * Start a Razorpay checkout for a plan. Stub-safe: when keys are absent it
 * returns { configured: false } so the UI can fall back (or owners can grant a
 * plan manually). With keys, it creates a Razorpay order and returns what the
 * client needs to open checkout; payment is confirmed via the webhook.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (session.role !== "owner") return Response.json({ error: "Only the owner can change the plan." }, { status: 403 });

  if (arePaymentsPaused()) {
    const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(PAYMENTS_PAUSED_UNTIL);
    return Response.json(
      { error: `Skope is free for everyone right now. Payments open on ${when}, nothing to pay today.` },
      { status: 409 },
    );
  }

  let body: { plan?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }
  const plan = body.plan as OrgPlan;
  if (!PAID_PLANS.includes(plan)) return Response.json({ error: "Pick a paid plan." }, { status: 400 });

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    return Response.json({ configured: false });
  }

  const amount = getLimits(plan).priceInr * 100; // paise
  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency: "INR", notes: { orgId: session.orgId, plan } }),
  });
  if (!res.ok) {
    console.error("[billing/checkout] razorpay order failed", res.status, await res.text());
    return Response.json({ error: "Couldn't start checkout. Try again." }, { status: 502 });
  }
  const order = (await res.json()) as { id: string };
  return Response.json({ configured: true, orderId: order.id, keyId, amount, plan });
}
