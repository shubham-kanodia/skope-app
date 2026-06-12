import { describe, it, expect } from "vitest";
import { aesEncrypt, aesDecrypt, randomKey } from "./aes";

describe("aes-256-gcm", () => {
  it("round-trips plaintext", () => {
    const key = randomKey();
    const pt = Buffer.from("founder@acme.in");
    expect(aesDecrypt(key, aesEncrypt(key, pt)).toString()).toBe("founder@acme.in");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const key = randomKey();
    const pt = Buffer.from("x");
    expect(aesEncrypt(key, pt).equals(aesEncrypt(key, pt))).toBe(false);
  });

  it("fails to decrypt with the wrong key", () => {
    const blob = aesEncrypt(randomKey(), Buffer.from("secret"));
    expect(() => aesDecrypt(randomKey(), blob)).toThrow();
  });

  it("fails on tampered ciphertext (auth tag)", () => {
    const key = randomKey();
    const blob = aesEncrypt(key, Buffer.from("secret"));
    blob[blob.length - 1] ^= 0xff;
    expect(() => aesDecrypt(key, blob)).toThrow();
  });

  it("rejects wrong key length and short blobs", () => {
    expect(() => aesEncrypt(Buffer.alloc(16), Buffer.from("x"))).toThrow();
    expect(() => aesDecrypt(randomKey(), Buffer.alloc(4))).toThrow();
  });
});
