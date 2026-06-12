import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM primitives. Blob layout: iv(12) ‖ authTag(16) ‖ ciphertext.
 * Pure (no DB) so it's unit-testable; callers supply the 32-byte key.
 */
const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

export function aesEncrypt(key: Buffer, plaintext: Buffer): Buffer {
  assertKey(key);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]);
}

export function aesDecrypt(key: Buffer, blob: Buffer): Buffer {
  assertKey(key);
  if (blob.length < IV_LEN + TAG_LEN) throw new Error("ciphertext too short");
  const iv = blob.subarray(0, IV_LEN);
  const tag = blob.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = blob.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

export function randomKey(): Buffer {
  return randomBytes(32);
}

function assertKey(key: Buffer): void {
  if (key.length !== 32) throw new Error(`AES-256 key must be 32 bytes, got ${key.length}`);
}
