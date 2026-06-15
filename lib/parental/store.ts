import { randomBytes, randomUUID, createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { encryptField, decryptField } from "@/lib/encryption";
import { writeConsentReceipt } from "@/lib/consent/write";
import { DEFAULT_PURPOSES } from "@/lib/banner/settings";

/**
 * Verifiable parental/guardian consent (DPDP §9(1)). A child visitor's guardian
 * is emailed a verification link; confirming it appends a `parental_grant`
 * receipt for the child's subject. Important: §9(3) bars tracking, behavioural
 * monitoring, and targeted advertising directed at children, so parental consent
 * lawfully covers only essential processing, analytics and marketing stay
 * DENIED for a child even after the guardian confirms.
 */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

const ESSENTIAL = DEFAULT_PURPOSES.filter((p) => p.isEssential).map((p) => p.key);
const NON_ESSENTIAL = DEFAULT_PURPOSES.filter((p) => !p.isEssential).map((p) => p.key);

export interface CreatedParentalConsent {
  id: string;
  token: string; // raw, emailed once
}

/** Record a pending parental-consent request. Returns the raw verification token. */
export async function createPendingParentalConsent(input: {
  siteId: string;
  orgId: string;
  subjectId: string;
  guardianEmail: string;
}): Promise<CreatedParentalConsent> {
  const token = randomBytes(32).toString("base64url");
  const guardianEnc = await encryptField(input.orgId, input.guardianEmail);
  const rows = await sql`
    insert into parental_consents (site_id, subject_id, guardian_contact_enc, token_hash, purposes)
    values (${input.siteId}, ${input.subjectId}, ${guardianEnc}, ${hashToken(token)}, ${ESSENTIAL})
    returning id`;
  return { id: rows[0].id as string, token };
}

export interface ParentalGrantResult {
  ok: boolean;
  alreadyVerified?: boolean;
  domain?: string;
}

/**
 * Verify a token and grant: flip pending → verified and append a
 * `parental_grant` receipt for the child's subject (essential granted,
 * non-essential denied). Idempotent on an already-verified row.
 */
export async function verifyAndGrant(token: string): Promise<ParentalGrantResult> {
  const rows = await sql`
    select pc.id, pc.site_id, pc.subject_id, pc.status, s.domain
    from parental_consents pc join sites s on s.id = pc.site_id
    where pc.token_hash = ${hashToken(token)}
    limit 1`;
  if (!rows[0]) return { ok: false };
  const row = rows[0] as Record<string, unknown>;
  if (row.status === "verified") return { ok: true, alreadyVerified: true, domain: row.domain as string };
  if (row.status !== "pending") return { ok: false };

  await sql`update parental_consents set status = 'verified', verified_at = now() where id = ${row.id as string}`;

  await writeConsentReceipt({
    id: randomUUID(),
    siteId: row.site_id as string,
    subjectId: row.subject_id as string,
    action: "parental_grant",
    purposesGranted: ESSENTIAL,
    purposesDenied: NON_ESSENTIAL, // §9(3): no tracking/targeting at children, even with consent
    noticeVersion: null,
    language: null,
    region: null,
    method: "preference_center",
    formId: null,
    occurredAt: new Date().toISOString(),
    userAgentHash: null,
    ipTruncated: null,
  });

  return { ok: true, domain: row.domain as string };
}

export interface ParentalConsentRow {
  id: string;
  domain: string;
  subjectId: string;
  guardianEmail: string | null;
  method: string;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
}

/** Parental consents for an org (export/audit). Decrypts guardian contact. */
export async function listParentalConsentsForOrg(orgId: string): Promise<ParentalConsentRow[]> {
  const rows = await sql`
    select pc.id, pc.subject_id, pc.guardian_contact_enc, pc.method, pc.status,
           pc.verified_at, pc.created_at, s.domain
    from parental_consents pc join sites s on s.id = pc.site_id
    where s.org_id = ${orgId}
    order by pc.created_at desc`;
  const out: ParentalConsentRow[] = [];
  for (const r of rows as unknown as Record<string, unknown>[]) {
    let guardianEmail: string | null = null;
    if (r.guardian_contact_enc) {
      try {
        guardianEmail = await decryptField(orgId, toBuffer(r.guardian_contact_enc));
      } catch {
        guardianEmail = null;
      }
    }
    out.push({
      id: r.id as string,
      domain: r.domain as string,
      subjectId: r.subject_id as string,
      guardianEmail,
      method: r.method as string,
      status: r.status as string,
      verifiedAt: (r.verified_at as string | null) ?? null,
      createdAt: r.created_at as string,
    });
  }
  return out;
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
