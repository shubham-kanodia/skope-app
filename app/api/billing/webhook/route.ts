import { createHmac, timingSafeEqual } from "node:crypto";
import { sql } from "@/lib/db/client";
import { PAID_PLANS } from "@/lib/plans";
import type { OrgPlan } from "@/lib/entitlement";

export const runtime = "nodejs";

/**
 * Razorpay webhook. Verifies the HMAC signature and, on a successful payment,
 * activates the plan recorded in the order notes (orgId + plan). Disabled (503)
 * when the webhook secret isn't configured.
 */
export async function POST(request: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook not configured." }, { status: 503 });

  const raw = await request.text();
  const sig = request.headers.get("x-razorpay-signature") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Bad signature." }, { status: 401 });
  }

  let event: {
    event?: string;
    payload?: {
      payment?: { entity?: { notes?: Record<string, string> } };
      order?: { entity?: { notes?: Record<string, string> } };
      subscription?: { entity?: { id?: string } };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  if (event.event === "payment.captured" || event.event === "order.paid" || event.event === "subscription.charged") {
    const notes = event.payload?.payment?.entity?.notes ?? event.payload?.order?.entity?.notes;
    const orgId = notes?.orgId;
    const plan = notes?.plan as OrgPlan | undefined;
    if (orgId && plan && PAID_PLANS.includes(plan)) {
      const activeUntil = new Date(Date.now() + 31 * 86_400_000);
      const subId = event.payload?.subscription?.entity?.id ?? null;
      await sql`
        update orgs set plan = ${plan}, plan_active_until = ${activeUntil},
                        razorpay_subscription_id = coalesce(${subId}, razorpay_subscription_id)
        where id = ${orgId}`;
    }
  }

  return Response.json({ ok: true });
}
