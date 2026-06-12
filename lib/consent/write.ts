import { sql } from "@/lib/db/client";
import { computeRowHash } from "@/lib/consent-core/hash-chain";
import type { ConsentAction, ConsentMethod, ReceiptCore } from "@/lib/consent-core/types";

export interface ConsentWriteInput {
  id: string; // client-generated UUID → idempotency key
  siteId: string;
  subjectId: string;
  action: ConsentAction;
  purposesGranted: string[];
  purposesDenied: string[];
  noticeVersion: number | null;
  language: string | null;
  region: string | null;
  method: ConsentMethod;
  formId: string | null;
  occurredAt: string; // normalized ISO 8601 UTC (server time)
  userAgentHash: string | null;
  ipTruncated: string | null;
}

export interface ConsentWriteResult {
  idempotent: boolean;
  seq: number;
}

/**
 * Append a receipt to the per-site hash chain.
 *
 * - Idempotent on the client UUID: a retried POST returns the existing row.
 * - A per-site advisory lock serializes appends so `seq` and `prev_hash` are
 *   consistent even under concurrent writes (the chain must be linear).
 * - Increments the monthly usage counter for plan enforcement.
 */
export async function writeConsentReceipt(input: ConsentWriteInput): Promise<ConsentWriteResult> {
  return sql.begin(async (tx) => {
    const existing = await tx`select seq from consent_receipts where id = ${input.id}`;
    if (existing[0]) return { idempotent: true, seq: Number(existing[0].seq) };

    // Serialize chain appends for this site.
    await tx`select pg_advisory_xact_lock(hashtext(${input.siteId}))`;

    const last = await tx`
      select seq, row_hash from consent_receipts
      where site_id = ${input.siteId} order by seq desc limit 1`;
    const seq = (last[0] ? Number(last[0].seq) : 0) + 1;
    const prevHash = last[0] ? toBuffer(last[0].row_hash) : null;

    const core: ReceiptCore = {
      siteId: input.siteId,
      subjectId: input.subjectId,
      action: input.action,
      purposesGranted: input.purposesGranted,
      purposesDenied: input.purposesDenied,
      noticeVersion: input.noticeVersion,
      languageShown: input.language,
      region: input.region,
      method: input.method,
      formId: input.formId,
      occurredAt: input.occurredAt,
      seq,
    };
    const rowHash = computeRowHash(prevHash, core);

    await tx`
      insert into consent_receipts
        (id, site_id, subject_id, purposes_granted, purposes_denied, action, notice_version,
         language_shown, region, method, form_id, user_agent_hash, ip_truncated, occurred_at,
         seq, prev_hash, row_hash)
      values
        (${input.id}, ${input.siteId}, ${input.subjectId},
         ${input.purposesGranted}, ${input.purposesDenied}, ${input.action}, ${input.noticeVersion},
         ${input.language}, ${input.region}, ${input.method}, ${input.formId},
         ${input.userAgentHash}, ${input.ipTruncated}, ${input.occurredAt},
         ${seq}, ${prevHash}, ${rowHash})`;

    const month = input.occurredAt.slice(0, 7); // YYYY-MM
    await tx`
      insert into usage_counters (site_id, month, consent_events)
      values (${input.siteId}, ${month}, 1)
      on conflict (site_id, month)
      do update set consent_events = usage_counters.consent_events + 1`;

    return { idempotent: false, seq };
  });
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
