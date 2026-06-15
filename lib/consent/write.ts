import { sql } from "@/lib/db/client";
import { computeRowHash } from "@/lib/consent-core/hash-chain";
import type { ConsentAction, ConsentMethod, ReceiptCore } from "@/lib/consent-core/types";
import { openObligation } from "@/lib/erasure/store";
import { contactFromSettings } from "@/lib/contact/settings";

export interface ConsentWriteInput {
  id: string; // client-generated UUID → idempotency key
  siteId: string;
  subjectId: string;
  action: ConsentAction;
  purposesGranted: string[];
  purposesDenied: string[];
  noticeVersion: number | null;
  noticeChecksum?: string | null;
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
      noticeChecksum: input.noticeChecksum ?? null,
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
         notice_checksum, language_shown, region, method, form_id, user_agent_hash, ip_truncated,
         occurred_at, seq, prev_hash, row_hash)
      values
        (${input.id}, ${input.siteId}, ${input.subjectId},
         ${input.purposesGranted}, ${input.purposesDenied}, ${input.action}, ${input.noticeVersion},
         ${input.noticeChecksum ?? null}, ${input.language}, ${input.region}, ${input.method}, ${input.formId},
         ${input.userAgentHash}, ${input.ipTruncated}, ${input.occurredAt},
         ${seq}, ${prevHash}, ${rowHash})`;

    const month = input.occurredAt.slice(0, 7); // YYYY-MM
    await tx`
      insert into usage_counters (site_id, month, consent_events)
      values (${input.siteId}, ${month}, 1)
      on conflict (site_id, month)
      do update set consent_events = usage_counters.consent_events + 1`;

    // DPDP §8(7): a withdrawal raises an erasure obligation. Open it in the same
    // transaction as the receipt so the duty is never lost, with a due date a
    // "reasonable time" out (the site's published response window). Idempotent
    // on (site, subject, kind), so repeated withdrawals don't pile up rows.
    if (input.action === "withdraw" || input.action === "withdraw_all") {
      const siteRows = await tx`select settings from sites where id = ${input.siteId} limit 1`;
      const days = contactFromSettings((siteRows[0]?.settings ?? {}) as Record<string, unknown>).responseDays;
      const { id: obligationId } = await openObligation(
        {
          siteId: input.siteId,
          subjectId: input.subjectId,
          kind: "withdrawal",
          sourceAction: input.action,
          basis: "Consent withdrawn, cease processing and erase data no longer lawfully held.",
          dueAt: new Date(Date.parse(input.occurredAt) + days * 86_400_000),
        },
        tx,
      );

      // DPDP §6(6)/§8(7)(b): cause processors to cease. Fan out one cessation
      // task per recipient (idempotent on obligation+recipient), in the same
      // transaction. The actual signal (webhook / manual) is effected later.
      if (obligationId) {
        await tx`
          insert into cessation_tasks (obligation_id, recipient_id)
          select ${obligationId}, r.id from recipients r where r.site_id = ${input.siteId}
          on conflict (obligation_id, recipient_id) do nothing`;
      }
    }

    return { idempotent: false, seq };
  });
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
