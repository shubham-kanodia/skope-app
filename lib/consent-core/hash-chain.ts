import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical";
import type { ReceiptCore } from "./types";

/**
 * Per-site tamper-evident ledger.
 *
 *   row_hash = SHA256( prev_hash ‖ canonical_json(receipt) )
 *
 * The genesis row uses an all-zero prev_hash. Because each hash binds the
 * previous one, altering or removing any historical receipt breaks every hash
 * after it, that's the "tamper-evident" guarantee, and it must be real.
 */
const HASH_BYTES = 32;
export const GENESIS_PREV_HASH = Buffer.alloc(HASH_BYTES, 0);

/** Stable, sorted view of a receipt used as the hash input. */
export function canonicalReceipt(r: ReceiptCore): string {
  return canonicalJson({
    siteId: r.siteId,
    subjectId: r.subjectId,
    action: r.action,
    purposesGranted: [...r.purposesGranted].sort(),
    purposesDenied: [...r.purposesDenied].sort(),
    noticeVersion: r.noticeVersion,
    languageShown: r.languageShown,
    region: r.region,
    method: r.method,
    formId: r.formId,
    occurredAt: r.occurredAt,
    seq: r.seq,
  });
}

export function computeRowHash(prevHash: Buffer | null, receipt: ReceiptCore): Buffer {
  const prev = prevHash ?? GENESIS_PREV_HASH;
  return createHash("sha256")
    .update(prev)
    .update(Buffer.from(canonicalReceipt(receipt), "utf8"))
    .digest();
}

export interface ChainLink extends ReceiptCore {
  prevHash: Buffer | null;
  rowHash: Buffer;
}

export interface ChainVerification {
  ok: boolean;
  /** seq of the first receipt that fails verification, if any. */
  brokenAt: number | null;
  reason?: string;
}

/**
 * Verify an ordered list of receipts (ascending seq) forms an intact chain:
 * seq is contiguous, prev_hash links to the previous row_hash, and every
 * row_hash recomputes from its contents.
 */
export function verifyChain(links: ChainLink[]): ChainVerification {
  let expectedPrev: Buffer = GENESIS_PREV_HASH;
  let expectedSeq = 1;

  for (const link of links) {
    if (link.seq !== expectedSeq) {
      return { ok: false, brokenAt: link.seq, reason: `seq gap: expected ${expectedSeq}` };
    }
    const prev = link.prevHash ?? GENESIS_PREV_HASH;
    if (!prev.equals(expectedPrev)) {
      return { ok: false, brokenAt: link.seq, reason: "prev_hash mismatch" };
    }
    const recomputed = computeRowHash(prev, link);
    if (!recomputed.equals(link.rowHash)) {
      return { ok: false, brokenAt: link.seq, reason: "row_hash mismatch (tampered contents)" };
    }
    expectedPrev = link.rowHash;
    expectedSeq += 1;
  }

  return { ok: true, brokenAt: null };
}
