import { randomBytes, createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { encryptField, decryptField } from "@/lib/encryption";
import { contactFromSettings } from "@/lib/contact/settings";
import { buildEvidence } from "./evidence";

/**
 * Data-principal rights requests (DPDP §11–14): access, correction, erasure,
 * nomination, and grievance. The requester's email is encrypted at rest with the
 * org's DEK; only the SHA-256 hash of the verification token is stored, so the
 * raw token lives only in the verification email.
 *
 * Flow: intake (status 'verifying') → email link → verify (status 'new', due_at
 * set from the site's response window) → fiduciary works it in the dashboard
 * queue → 'in_progress' → 'done' | 'rejected'.
 */
export type RequestType = "access" | "correction" | "erasure" | "nomination" | "grievance";
export type RequestStatus = "new" | "verifying" | "in_progress" | "done" | "rejected";

export const REQUEST_TYPES: RequestType[] = ["access", "correction", "erasure", "nomination", "grievance"];

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface CreatedRequest {
  id: string;
  token: string; // raw, emailed once
}

/** Create a request in 'verifying' state. Returns the raw verification token. */
export async function createRequest(input: {
  siteId: string;
  orgId: string;
  type: RequestType;
  email: string;
  detail: string;
}): Promise<CreatedRequest> {
  const token = randomBytes(32).toString("base64url");
  const contactEnc = await encryptField(input.orgId, input.email);

  // The free-text detail can contain personal data the requester typed, so it's
  // encrypted at rest with the org DEK (like the email), never stored in clear.
  const detail = input.detail.slice(0, 4000);
  const detailEnc = detail ? (await encryptField(input.orgId, detail)).toString("base64") : null;
  const evidence = buildEvidence(detailEnc);

  const rows = await sql`
    insert into requests (site_id, contact_enc, type, status, verification_token, evidence)
    values (${input.siteId}, ${contactEnc}, ${input.type}, 'verifying', ${hashToken(token)},
            ${sql.json(evidence)})
    returning id`;
  return { id: rows[0].id as string, token };
}

export interface VerifiedRequest {
  id: string;
  siteId: string;
  type: RequestType;
}

/**
 * Verify a request by its token: flip 'verifying' → 'new' and stamp the due date
 * from the site's published response window. Idempotent-safe (only matches a row
 * still in 'verifying'). Returns the request or null.
 */
export async function verifyRequest(token: string): Promise<VerifiedRequest | null> {
  const rows = await sql`
    select r.id, r.site_id, r.type, s.settings
    from requests r join sites s on s.id = r.site_id
    where r.verification_token = ${hashToken(token)} and r.status = 'verifying'
    limit 1`;
  if (!rows[0]) return null;

  const days = contactFromSettings((rows[0].settings ?? {}) as Record<string, unknown>).responseDays;
  const dueAt = new Date(Date.now() + days * 86400000);
  await sql`update requests set status = 'new', due_at = ${dueAt} where id = ${rows[0].id}`;
  return { id: rows[0].id as string, siteId: rows[0].site_id as string, type: rows[0].type as RequestType };
}

export interface RequestRow {
  id: string;
  type: RequestType;
  status: RequestStatus;
  email: string | null;
  detail: string;
  dueAt: string | null;
  completedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
  domain: string;
}

/**
 * Verified requests across an org's sites (hides 'verifying' rows that were never
 * confirmed). Decrypts the requester email with the org DEK.
 */
export async function listRequestsForOrg(orgId: string): Promise<RequestRow[]> {
  const rows = await sql`
    select r.id, r.type, r.status, r.contact_enc, r.due_at, r.completed_at,
           r.resolution_note, r.evidence, r.created_at, s.domain
    from requests r join sites s on s.id = r.site_id
    where s.org_id = ${orgId} and r.status <> 'verifying'
    order by r.created_at desc
    limit 200`;
  return decryptRequestRows(orgId, rows as unknown as Record<string, unknown>[]);
}

/** Decrypt contact + detail for a set of request rows with the org DEK. */
async function decryptRequestRows(orgId: string, rows: Record<string, unknown>[]): Promise<RequestRow[]> {
  const out: RequestRow[] = [];
  for (const r of rows) {
    let email: string | null = null;
    if (r.contact_enc) {
      try {
        email = await decryptField(orgId, toBuffer(r.contact_enc));
      } catch {
        email = null;
      }
    }
    const evidence = (r.evidence ?? {}) as { detailEnc?: string };
    let detail = "";
    if (evidence.detailEnc) {
      try {
        detail = await decryptField(orgId, Buffer.from(evidence.detailEnc, "base64"));
      } catch {
        detail = "";
      }
    }
    out.push({
      id: r.id as string,
      type: r.type as RequestType,
      status: r.status as RequestStatus,
      email,
      detail,
      dueAt: (r.due_at as string | null) ?? null,
      completedAt: (r.completed_at as string | null) ?? null,
      resolutionNote: (r.resolution_note as string | null) ?? null,
      createdAt: r.created_at as string,
      domain: r.domain as string,
    });
  }
  return out;
}

/**
 * All verified requests for export (no row cap; the queue UI keeps its 200).
 * Decrypted like listRequestsForOrg — exports carry real contact details, the
 * fiduciary needs them to evidence their handling. Treat the file as
 * confidential (documented in SECURITY.md).
 */
export async function listRequestsForExport(orgId: string, siteId?: string): Promise<RequestRow[]> {
  const siteFilter = siteId ? sql`and r.site_id = ${siteId}` : sql``;
  const rows = await sql`
    select r.id, r.type, r.status, r.contact_enc, r.due_at, r.completed_at,
           r.resolution_note, r.evidence, r.created_at, s.domain
    from requests r join sites s on s.id = r.site_id
    where s.org_id = ${orgId} and r.status <> 'verifying' ${siteFilter}
    order by r.created_at desc`;
  return decryptRequestRows(orgId, rows as unknown as Record<string, unknown>[]);
}

/**
 * Move a request through its workflow, scoped to the org (authorization baked
 * into the WHERE). Stamps completed_at when closed. Returns the requester email
 * (decrypted) so the caller can notify them.
 */
export async function updateRequestStatus(
  orgId: string,
  requestId: string,
  status: RequestStatus,
  note: string | null,
): Promise<{ email: string | null; domain: string; type: RequestType } | null> {
  const closing = status === "done" || status === "rejected";
  const completedAt = closing ? new Date() : null;
  const rows = await sql`
    update requests r
       set status = ${status},
           resolution_note = ${note},
           completed_at = ${completedAt}
      from sites s
     where r.id = ${requestId} and s.id = r.site_id and s.org_id = ${orgId}
    returning r.contact_enc, r.type, s.domain`;
  if (!rows[0]) return null;

  let email: string | null = null;
  if (rows[0].contact_enc) {
    try {
      email = await decryptField(orgId, toBuffer(rows[0].contact_enc));
    } catch {
      email = null;
    }
  }
  return { email, domain: rows[0].domain as string, type: rows[0].type as RequestType };
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
