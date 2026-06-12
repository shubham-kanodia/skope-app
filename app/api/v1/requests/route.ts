import { getSiteByKey } from "@/lib/sites/by-key";
import { createRequest, REQUEST_TYPES, type RequestType } from "@/lib/requests/store";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpTruncated } from "@/lib/consent/request-meta";
import { sendEmail } from "@/lib/email/send";
import { isValidEmail } from "@/lib/contact/settings";

export const runtime = "nodejs";

const TYPES = new Set<RequestType>(REQUEST_TYPES);

const TYPE_LABEL: Record<RequestType, string> = {
  access: "access your data",
  correction: "correct your data",
  erasure: "erase your data",
  nomination: "nominate someone",
  grievance: "raise a grievance",
};

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const siteKey = String(body.siteKey ?? "");
  if (!siteKey.startsWith("sk_")) return Response.json({ error: "Invalid site." }, { status: 400 });

  const type = body.type as RequestType;
  if (!TYPES.has(type)) return Response.json({ error: "Pick a request type." }, { status: 400 });

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return Response.json({ error: "Enter a valid email." }, { status: 400 });

  const detail = typeof body.detail === "string" ? body.detail.slice(0, 4000) : "";

  const ipTruncated = clientIpTruncated(request.headers);
  const rl = await rateLimit(`requests:${siteKey}:${ipTruncated ?? "noip"}`, 5, 3600);
  if (!rl.ok) return Response.json({ error: "Too many requests. Try again later." }, { status: 429 });

  const site = await getSiteByKey(siteKey);
  if (!site || site.status === "archived") return Response.json({ error: "Unknown site." }, { status: 404 });

  try {
    const { token } = await createRequest({ siteId: site.id, orgId: site.orgId, type, email, detail });
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const url = `${base}/api/v1/requests/verify?site=${encodeURIComponent(siteKey)}&token=${token}`;

    await sendEmail({
      to: email,
      subject: "Confirm your privacy request",
      text: `You asked to ${TYPE_LABEL[type]}. Confirm it's you by opening this link:\n${url}\n\nIf you didn't make this request, ignore this email.`,
      html: verifyEmailHtml(url, TYPE_LABEL[type]),
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[/v1/requests] create failed", err);
    return Response.json({ error: "Could not submit your request. Try again." }, { status: 500 });
  }
}

function verifyEmailHtml(url: string, label: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0b0d;line-height:1.5">
    <p>You asked to ${label}. Confirm it's you:</p>
    <p><a href="${url}" style="display:inline-block;background:#0052ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:100px">Confirm request</a></p>
    <p style="color:#5b616e;font-size:14px">If you didn't make this request, ignore this email.</p>
  </body></html>`;
}
