import { createHmac, timingSafeEqual } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db/client";
import { PAID_PLANS } from "@/lib/plans";
import type { OrgPlan } from "@/lib/entitlement";

export const runtime = "nodejs";

/**
 * Confirm a Razorpay checkout from the client. The checkout widget returns
 * razorpay_order_id, razorpay_payment_id and razorpay_signature on success; we
 * verify HMAC_SHA256(order_id|payment_id, key_secret) and activate the plan
 * straight away. The webhook (app/api/billing/webhook) remains the backstop for
 * payments the browser never reports back.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });
  if (session.role !== "owner") return Response.json({ error: "Only the owner can change the plan." }, { status: 403 });

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return Response.json({ error: "Payments aren't configured." }, { status: 503 });

  let body: {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
    plan?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid body." }, { status: 400 });
  }

  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  const plan = body.plan as OrgPlan;
  if (!orderId || !paymentId || !signature) return Response.json({ error: "Missing payment fields." }, { status: 400 });
  if (!PAID_PLANS.includes(plan)) return Response.json({ error: "Pick a paid plan." }, { status: 400 });

  const expected = createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Couldn't verify the payment." }, { status: 400 });
  }

  const activeUntil = new Date(Date.now() + 31 * 86_400_000);
  await sql`update orgs set plan = ${plan}, plan_active_until = ${activeUntil} where id = ${session.orgId}`;
  return Response.json({ ok: true, plan });
}
