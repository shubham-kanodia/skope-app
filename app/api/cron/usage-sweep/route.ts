import { runDunningSweep } from "@/lib/billing/dunning";

export const runtime = "nodejs";

/**
 * Usage-dunning sweep, meant to be called on a schedule (Vercel cron / external).
 * Protected by CRON_SECRET; disabled (503) when the secret isn't configured so
 * the endpoint is never open.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron not configured." }, { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
  if (provided !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await runDunningSweep();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/usage-sweep] failed", err);
    return Response.json({ error: "Sweep failed." }, { status: 500 });
  }
}
