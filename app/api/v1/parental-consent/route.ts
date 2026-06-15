import { corsHeaders, preflight } from "@/lib/http/cors";
import { getSiteByKey, getPublicSiteByKey } from "@/lib/sites/by-key";
import { childrenFromSettings } from "@/lib/children/settings";
import { createPendingParentalConsent } from "@/lib/parental/store";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpTruncated } from "@/lib/consent/request-meta";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function OPTIONS() {
  return preflight();
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

/**
 * Start verifiable parental consent (DPDP §9(1)): a child visitor submits a
 * guardian's email; we record a pending consent and email the guardian a link to
 * confirm. Until they confirm, only essential processing happens. Public + CORS,
 * like the consent endpoint; rate-limited per site + truncated IP.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const siteKey = String(body.siteKey ?? "");
  if (!siteKey.startsWith("sk_")) return json({ error: "Invalid site key." }, 400);

  const subjectId = String(body.subjectId ?? "").toLowerCase();
  if (!UUID_RE.test(subjectId)) return json({ error: "subjectId must be a UUID." }, 400);

  const guardianEmail = String(body.guardianEmail ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(guardianEmail) || guardianEmail.length > 160) {
    return json({ error: "Enter a valid guardian email." }, 400);
  }

  const ipTruncated = clientIpTruncated(request.headers);
  const rl = await rateLimit(`parental:${siteKey}:${ipTruncated ?? "noip"}`, 10, 60);
  if (!rl.ok) return json({ error: "Too many requests. Slow down." }, 429);

  const site = await getSiteByKey(siteKey);
  if (!site || site.status === "archived") return json({ error: "Unknown site key." }, 404);

  // Only meaningful when the site actually runs child mode.
  const publicSite = await getPublicSiteByKey(siteKey);
  const children = childrenFromSettings(publicSite?.settings ?? {});
  if (children.childMode !== "age_gate") {
    return json({ error: "This site does not require parental consent." }, 400);
  }

  try {
    const { token } = await createPendingParentalConsent({
      siteId: site.id,
      orgId: site.orgId,
      subjectId,
      guardianEmail,
    });

    const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const link = `${appBase}/p/${encodeURIComponent(siteKey)}/parental/${token}`;
    const who = publicSite?.orgName || publicSite?.domain || "a website";
    await sendEmail({
      to: guardianEmail,
      subject: `Approve your child's use of ${who}`,
      text: `A child indicated you are their parent or guardian. To approve ${who} processing their personal data as described in its privacy notice, confirm here:\n\n${link}\n\nIf you didn't expect this, you can ignore this email, nothing happens without your confirmation.`,
      html: `<p>A child indicated you are their parent or guardian.</p><p>To approve <strong>${escapeHtml(
        who,
      )}</strong> processing their personal data as described in its privacy notice, confirm here:</p><p><a href="${escapeHtml(
        link,
      )}">Approve and continue</a></p><p style="color:#5b616e">If you didn't expect this, you can ignore this email, nothing happens without your confirmation.</p>`,
    });

    return json({ ok: true });
  } catch (err) {
    console.error("[/v1/parental-consent] failed", err);
    return json({ error: "Could not start parental consent. Try again." }, 500);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
