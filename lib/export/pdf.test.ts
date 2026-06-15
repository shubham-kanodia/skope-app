import { describe, expect, it } from "vitest";
import { buildSimplePdf } from "./pdf";

describe("buildSimplePdf", () => {
  it("produces a structurally sound PDF", () => {
    const pdf = buildSimplePdf([
      { text: "Skope audit bundle", size: 18, bold: true },
      { text: "Generated for acme.in" },
      { text: "Chain status: OK (escaped parens) and \\ backslash" },
    ]);
    const s = new TextDecoder().decode(pdf);

    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(s).toContain("/Type /Catalog");
    expect(s).toContain("(Skope audit bundle) Tj");
    // Parens and backslashes must be escaped inside string literals.
    expect(s).toContain("\\(escaped parens\\)");
    expect(s).toContain("\\\\ backslash");

    // startxref points at the actual xref table.
    const m = s.match(/startxref\n(\d+)\n%%EOF/);
    expect(m).not.toBeNull();
    expect(s.slice(Number(m![1]), Number(m![1]) + 4)).toBe("xref");

    // Every xref offset points at the object it claims to.
    const xref = s.slice(Number(m![1]));
    const offsets = [...xref.matchAll(/^(\d{10}) 00000 n /gm)].map((x) => Number(x[1]));
    offsets.forEach((off, i) => {
      expect(s.slice(off, off + String(i + 1).length + 6)).toBe(`${i + 1} 0 obj`);
    });
  });

  it("replaces non-ASCII so offsets stay byte-accurate", () => {
    const pdf = buildSimplePdf([{ text: "नोटिस, hindi" }]);
    const s = new TextDecoder().decode(pdf);
    expect(s).not.toMatch(/[^\x00-\x7f]/);
    expect(pdf.length).toBe(s.length); // pure ASCII: bytes == chars
  });
});
