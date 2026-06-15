import { sql } from "@/lib/db/client";
import { encryptField, decryptField } from "@/lib/encryption";
import { writeAudit } from "@/lib/audit/write";
import type { NominationStatus, NominationRow } from "./types";

// Re-export so existing server-side importers keep `@/lib/nominations/store` working.
export type { NominationStatus, NominationRow } from "./types";
export { NOMINATION_STATUS_LABELS } from "./types";

export async function createNomination(
  orgId: string,
  actorUserId: string,
  input: {
    siteId: string;
    principalRef: string | null;
    nomineeName: string;
    nomineeContact: string | null;
    relationship: string | null;
  },
): Promise<string> {
  const nameEnc = await encryptField(orgId, input.nomineeName);
  const contactEnc = input.nomineeContact ? await encryptField(orgId, input.nomineeContact) : null;
  const rows = await sql`
    insert into nominations (site_id, principal_ref, nominee_name_enc, nominee_contact_enc, relationship)
    values (${input.siteId}, ${input.principalRef}, ${nameEnc}, ${contactEnc}, ${input.relationship})
    returning id`;
  const id = rows[0].id as string;
  await writeAudit({ orgId, actorUserId, action: "nomination.record", target: id });
  return id;
}

export async function listNominations(orgId: string): Promise<NominationRow[]> {
  const rows = await sql`
    select n.id, n.site_id, n.principal_ref, n.nominee_name_enc, n.nominee_contact_enc,
           n.relationship, n.status, n.activated_at, n.created_at, s.domain
    from nominations n join sites s on s.id = n.site_id
    where s.org_id = ${orgId}
    order by n.created_at desc`;
  const out: NominationRow[] = [];
  for (const r of rows as unknown as Record<string, unknown>[]) {
    let nomineeName: string | null = null;
    let nomineeContact: string | null = null;
    try {
      if (r.nominee_name_enc) nomineeName = await decryptField(orgId, toBuffer(r.nominee_name_enc));
    } catch {
      nomineeName = null;
    }
    try {
      if (r.nominee_contact_enc) nomineeContact = await decryptField(orgId, toBuffer(r.nominee_contact_enc));
    } catch {
      nomineeContact = null;
    }
    out.push({
      id: r.id as string,
      siteId: r.site_id as string,
      domain: r.domain as string,
      principalRef: (r.principal_ref as string | null) ?? null,
      nomineeName,
      nomineeContact,
      relationship: (r.relationship as string | null) ?? null,
      status: r.status as NominationStatus,
      activatedAt: (r.activated_at as string | null) ?? null,
      createdAt: r.created_at as string,
    });
  }
  return out;
}

export async function setNominationStatus(
  orgId: string,
  actorUserId: string,
  id: string,
  status: NominationStatus,
): Promise<boolean> {
  const rows = await sql`
    update nominations n
       set status = ${status},
           activated_at = case when ${status} = 'activated' then now() else n.activated_at end
      from sites s
     where n.id = ${id} and s.id = n.site_id and s.org_id = ${orgId}
    returning n.id`;
  if (!rows[0]) return false;
  await writeAudit({
    orgId,
    actorUserId,
    action: status === "activated" ? "nomination.activate" : "nomination.status",
    target: id,
    diff: { status },
  });
  return true;
}

/** Nominations for the audit bundle (pseudonymous, no decrypted nominee PII). */
export async function listNominationsForExport(
  orgId: string,
): Promise<{ domain: string; relationship: string | null; status: string; activatedAt: string | null; createdAt: string }[]> {
  const rows = await sql`
    select s.domain, n.relationship, n.status, n.activated_at, n.created_at
    from nominations n join sites s on s.id = n.site_id
    where s.org_id = ${orgId} order by n.created_at desc`;
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    domain: r.domain as string,
    relationship: (r.relationship as string | null) ?? null,
    status: r.status as string,
    activatedAt: (r.activated_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
