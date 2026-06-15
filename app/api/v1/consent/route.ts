import { corsHeaders, preflight } from "@/lib/http/cors";
import { getSiteByKey } from "@/lib/sites/by-key";
import { writeConsentReceipt } from "@/lib/consent/write";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpTruncated, edgeCountry, userAgentHash } from "@/lib/consent/request-meta";
import type { ConsentAction, ConsentMethod } from "@/lib/consent-core/types";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set<ConsentAction>(["grant", "deny", "update", "withdraw", "withdraw_all"]);
const METHODS = new Set<ConsentMethod>(["banner", "preference_center", "form", "api"]);

export function OPTIONS() {
  return preflight();
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

function cleanKeys(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  if (value.length > 50) return null;
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string" || v.length === 0 || v.length > 64) return null;
    out.push(v);
  }
  return out;
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // --- validate ---
  // Lowercase UUIDs so they match Postgres's normalized uuid form when the
  // chain is later re-verified from the DB.
  const id = String(body.id ?? "").toLowerCase();
  if (!UUID_RE.test(id)) return json({ error: "id must be a UUID." }, 400);

  const siteKey = String(body.siteKey ?? "");
  if (!siteKey.startsWith("sk_")) return json({ error: "Invalid site key." }, 400);

  const subjectId = String(body.subjectId ?? "").toLowerCase();
  if (!UUID_RE.test(subjectId)) return json({ error: "subjectId must be a UUID." }, 400);

  const action = body.action as ConsentAction;
  if (!ACTIONS.has(action)) return json({ error: "Invalid action." }, 400);

  const method = (body.method ?? "banner") as ConsentMethod;
  if (!METHODS.has(method)) return json({ error: "Invalid method." }, 400);

  const purposesGranted = cleanKeys(body.purposesGranted ?? []);
  const purposesDenied = cleanKeys(body.purposesDenied ?? []);
  if (!purposesGranted || !purposesDenied) {
    return json({ error: "Invalid purposes." }, 400);
  }

  const noticeVersion =
    body.noticeVersion == null ? null : Number.isInteger(body.noticeVersion) ? (body.noticeVersion as number) : null;
  const language = typeof body.language === "string" ? body.language.slice(0, 12) : null;
  const formId = typeof body.formId === "string" ? body.formId.slice(0, 128) : null;
  // Checksum of the notice shown (DPDP §6(10)); hex sha-256, bounded.
  const noticeChecksum =
    typeof body.noticeChecksum === "string" && /^[0-9a-f]{8,128}$/i.test(body.noticeChecksum)
      ? body.noticeChecksum.toLowerCase()
      : null;

  // --- rate limit (per site + truncated IP) ---
  const ipTruncated = clientIpTruncated(request.headers);
  const rl = await rateLimit(`consent:${siteKey}:${ipTruncated ?? "noip"}`, 60, 60);
  if (!rl.ok) {
    return json({ error: "Too many requests. Slow down." }, 429);
  }

  // --- resolve site ---
  const site = await getSiteByKey(siteKey);
  if (!site || site.status === "archived") {
    return json({ error: "Unknown site key." }, 404);
  }

  // Region: prefer the client's cfg-derived value, fall back to the edge header.
  const clientRegion = typeof body.region === "string" && body.region.length === 2 ? body.region.toUpperCase() : null;
  const region = clientRegion ?? edgeCountry(request.headers);

  try {
    const result = await writeConsentReceipt({
      id,
      siteId: site.id,
      subjectId,
      action,
      purposesGranted,
      purposesDenied,
      noticeVersion,
      noticeChecksum,
      language,
      region,
      method,
      formId,
      occurredAt: new Date().toISOString(), // server time, trustworthy + deterministic
      userAgentHash: userAgentHash(request.headers),
      ipTruncated,
    });
    return json({ ok: true, idempotent: result.idempotent, seq: result.seq });
  } catch (err) {
    console.error("[/v1/consent] write failed", err);
    return json({ error: "Could not record consent. Try again." }, 500);
  }
}
