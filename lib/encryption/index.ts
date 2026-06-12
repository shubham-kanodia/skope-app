import { sql } from "@/lib/db/client";
import { aesEncrypt, aesDecrypt, randomKey } from "./aes";

/**
 * Field-level encryption with a two-tier key hierarchy:
 *   master KEK (env)  ──wraps──▶  per-org DEK (in org_data_keys)  ──encrypts──▶  PII fields
 *
 * Erasure is crypto-shredding: delete the wrapped DEK and every encrypted field
 * for that org is unrecoverable, even from backups.
 */

let cachedMaster: Buffer | null = null;
function masterKey(): Buffer {
  if (cachedMaster) return cachedMaster;
  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw) throw new Error("ENCRYPTION_MASTER_KEY is not set. See .env.example.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_MASTER_KEY must decode to 32 bytes (base64 of 32 random bytes).");
  }
  cachedMaster = key;
  return key;
}

// Plaintext DEK cache, keyed by orgId, avoids an unwrap per field op.
const dekCache = new Map<string, Buffer>();

/** Fetch the org's DEK, creating + wrapping one on first use (race-safe). */
export async function getOrgDataKey(orgId: string): Promise<Buffer> {
  const cached = dekCache.get(orgId);
  if (cached) return cached;

  const existing = await sql`select wrapped_dek from org_data_keys where org_id = ${orgId}`;
  if (existing[0]) {
    const dek = aesDecrypt(masterKey(), toBuffer(existing[0].wrapped_dek));
    dekCache.set(orgId, dek);
    return dek;
  }

  const dek = randomKey();
  const wrapped = aesEncrypt(masterKey(), dek);
  await sql`
    insert into org_data_keys (org_id, wrapped_dek) values (${orgId}, ${wrapped})
    on conflict (org_id) do nothing`;

  // Re-read in case a concurrent request won the insert, always use the stored key.
  const row = await sql`select wrapped_dek from org_data_keys where org_id = ${orgId}`;
  const finalDek = aesDecrypt(masterKey(), toBuffer(row[0].wrapped_dek));
  dekCache.set(orgId, finalDek);
  return finalDek;
}

export async function encryptField(orgId: string, plaintext: string): Promise<Buffer> {
  const dek = await getOrgDataKey(orgId);
  return aesEncrypt(dek, Buffer.from(plaintext, "utf8"));
}

export async function decryptField(orgId: string, blob: Buffer): Promise<string> {
  const dek = await getOrgDataKey(orgId);
  return aesDecrypt(dek, blob).toString("utf8");
}

/**
 * Crypto-shred an entire org: destroy its DEK. All encrypted PII becomes
 * unrecoverable. Call inside the org-deletion cascade.
 */
export async function cryptoShredOrg(orgId: string): Promise<void> {
  dekCache.delete(orgId);
  await sql`delete from org_data_keys where org_id = ${orgId}`;
}

function toBuffer(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error("expected bytea buffer from DB");
}
