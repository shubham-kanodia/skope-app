import { describe, expect, it } from "vitest";
import { buildEvidence } from "./evidence";

describe("buildEvidence", () => {
  it("never carries a plaintext detail key", () => {
    const withDetail = buildEvidence("base64-ciphertext");
    expect(withDetail).toEqual({ detailEnc: "base64-ciphertext", submittedEmail: true });
    expect("detail" in withDetail).toBe(false);

    const without = buildEvidence(null);
    expect(without).toEqual({ detailEnc: null, submittedEmail: true });
    expect("detail" in without).toBe(false);
  });
});
