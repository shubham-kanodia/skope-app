import { describe, expect, it } from "vitest";
import { coerceRecipients } from "./types";

describe("coerceRecipients", () => {
  it("rejects non-arrays", () => {
    expect(coerceRecipients(null)).toBeNull();
    expect(coerceRecipients({})).toBeNull();
  });

  it("drops rows without a name", () => {
    expect(coerceRecipients([{ name: "  " }, { role: "processor" }])).toEqual([]);
  });

  it("defaults role to processor and whitelists it", () => {
    expect(coerceRecipients([{ name: "A", role: "weird" }])![0].role).toBe("processor");
    expect(coerceRecipients([{ name: "A", role: "fiduciary" }])![0].role).toBe("fiduciary");
  });

  it("normalises country to a 2-letter upper code or null", () => {
    expect(coerceRecipients([{ name: "A", country: "in" }])![0].country).toBe("IN");
    expect(coerceRecipients([{ name: "A", country: "India" }])![0].country).toBeNull();
  });

  it("keeps only http(s) webhook urls", () => {
    expect(coerceRecipients([{ name: "A", webhookUrl: "https://x.example/cease" }])![0].webhookUrl).toBe(
      "https://x.example/cease",
    );
    expect(coerceRecipients([{ name: "A", webhookUrl: "ftp://x" }])![0].webhookUrl).toBeNull();
    expect(coerceRecipients([{ name: "A", webhookUrl: "not a url" }])![0].webhookUrl).toBeNull();
  });

  it("filters non-string data item keys", () => {
    expect(coerceRecipients([{ name: "A", dataItemKeys: ["email", 5, "", "phone"] }])![0].dataItemKeys).toEqual([
      "email",
      "phone",
    ]);
  });

  it("whitelists contract status", () => {
    expect(coerceRecipients([{ name: "A", contractStatus: "signed" }])![0].contractStatus).toBe("signed");
    expect(coerceRecipients([{ name: "A", contractStatus: "bogus" }])![0].contractStatus).toBeNull();
  });
});
