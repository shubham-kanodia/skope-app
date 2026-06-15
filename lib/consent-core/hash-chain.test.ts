import { describe, it, expect } from "vitest";
import {
  canonicalReceipt,
  computeRowHash,
  verifyChain,
  GENESIS_PREV_HASH,
  type ChainLink,
} from "./hash-chain";
import type { ReceiptCore } from "./types";

function core(seq: number, overrides: Partial<ReceiptCore> = {}): ReceiptCore {
  return {
    siteId: "site-1",
    subjectId: "subj-1",
    action: "grant",
    purposesGranted: ["analytics", "necessary"],
    purposesDenied: [],
    noticeVersion: 1,
    languageShown: "en",
    region: "IN",
    method: "banner",
    formId: null,
    occurredAt: "2026-06-11T00:00:00.000Z",
    seq,
    ...overrides,
  };
}

/** Build an intact chain of N links. */
function buildChain(n: number): ChainLink[] {
  const links: ChainLink[] = [];
  let prev: Buffer = GENESIS_PREV_HASH;
  for (let seq = 1; seq <= n; seq++) {
    const c = core(seq, { subjectId: `subj-${seq}` });
    const rowHash = computeRowHash(prev, c);
    links.push({ ...c, prevHash: seq === 1 ? null : prev, rowHash });
    prev = rowHash;
  }
  return links;
}

describe("canonicalReceipt", () => {
  it("sorts purpose lists so input order doesn't change the hash", () => {
    const a = canonicalReceipt(core(1, { purposesGranted: ["necessary", "analytics"] }));
    const b = canonicalReceipt(core(1, { purposesGranted: ["analytics", "necessary"] }));
    expect(a).toBe(b);
  });

  // §6(10) hardening: notice checksum is bound only when present, so historical
  // receipts (no checksum) must serialize exactly as before.
  it("omits noticeChecksum when absent, null, or empty (back-compat)", () => {
    const base = canonicalReceipt(core(1));
    expect(canonicalReceipt(core(1, { noticeChecksum: null }))).toBe(base);
    expect(canonicalReceipt(core(1, { noticeChecksum: undefined }))).toBe(base);
    expect(canonicalReceipt(core(1, { noticeChecksum: "" }))).toBe(base);
    expect(base).not.toContain("noticeChecksum");
  });

  it("binds noticeChecksum into the hash when present", () => {
    const without = computeRowHash(null, core(1));
    const withSum = computeRowHash(null, core(1, { noticeChecksum: "abc123" }));
    expect(without.equals(withSum)).toBe(false);
    expect(canonicalReceipt(core(1, { noticeChecksum: "abc123" }))).toContain("noticeChecksum");
  });

  it("keeps a pre-hardening row's hash stable (the back-catalogue still verifies)", () => {
    // A row written before the checksum field existed.
    const legacy = core(7, { noticeChecksum: undefined });
    const legacyHash = computeRowHash(GENESIS_PREV_HASH, legacy);
    // Re-reading it from the DB yields notice_checksum = null.
    const reread = core(7, { noticeChecksum: null });
    expect(computeRowHash(GENESIS_PREV_HASH, reread).equals(legacyHash)).toBe(true);
  });
});

describe("computeRowHash", () => {
  it("is deterministic and 32 bytes", () => {
    const h1 = computeRowHash(null, core(1));
    const h2 = computeRowHash(GENESIS_PREV_HASH, core(1));
    expect(h1.equals(h2)).toBe(true);
    expect(h1.length).toBe(32);
  });

  it("changes when contents change", () => {
    const h1 = computeRowHash(null, core(1));
    const h2 = computeRowHash(null, core(1, { region: "US" }));
    expect(h1.equals(h2)).toBe(false);
  });
});

describe("verifyChain", () => {
  it("accepts an intact chain", () => {
    expect(verifyChain(buildChain(5))).toEqual({ ok: true, brokenAt: null });
  });

  it("accepts an empty chain", () => {
    expect(verifyChain([])).toEqual({ ok: true, brokenAt: null });
  });

  it("detects a seq gap", () => {
    const chain = buildChain(3);
    chain.splice(1, 1); // remove seq 2
    const res = verifyChain(chain);
    expect(res.ok).toBe(false);
    expect(res.brokenAt).toBe(3);
  });

  it("detects tampered contents (row_hash mismatch)", () => {
    const chain = buildChain(3);
    chain[1] = { ...chain[1], region: "US" }; // mutate without recomputing hash
    const res = verifyChain(chain);
    expect(res.ok).toBe(false);
    expect(res.brokenAt).toBe(2);
    expect(res.reason).toContain("row_hash");
  });

  it("detects a broken prev_hash link", () => {
    const chain = buildChain(3);
    chain[2] = { ...chain[2], prevHash: Buffer.alloc(32, 9) };
    const res = verifyChain(chain);
    expect(res.ok).toBe(false);
    expect(res.brokenAt).toBe(3);
    expect(res.reason).toContain("prev_hash");
  });
});
