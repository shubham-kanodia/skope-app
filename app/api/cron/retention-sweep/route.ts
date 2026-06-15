import { runRetentionSweep } from "@/lib/retention/sweep";
import { runAuditReminders } from "@/lib/sdf/store";
import { runRetroSweep } from "@/lib/retro/store";

export const runtime = "nodejs";

/**
 * Retention/erasure sweep (DPDP §8(8)) plus SDF audit reminders (§10), called on
 * a schedule like usage-sweep. Register this wherever usage-sweep is triggered
 * (Vercel cron / external). A daily cadence is plenty. Protected by CRON_SECRET;
 * disabled (503) when the secret isn't configured so the endpoint is never open.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "Cron not configured." }, { status: 503 });

  const auth = request.headers.get("authorization");
  const provided = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
  if (provided !== secret) return Response.json({ error: "Unauthorized." }, { status: 401 });

  try {
    const result = await runRetentionSweep();
    const reminders = await runAuditReminders();
    const retro = await runRetroSweep();
    return Response.json({
      ok: true,
      ...result,
      auditReminders: reminders.reminded,
      retroSent: retro.sent,
      retroFailed: retro.failed,
    });
  } catch (err) {
    console.error("[cron/retention-sweep] failed", err);
    return Response.json({ error: "Sweep failed." }, { status: 500 });
  }
}
