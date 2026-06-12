import { describe, expect, it } from "vitest";
import { csvEscape, toCsvRow } from "./csv";

describe("csvEscape", () => {
  it("passes plain fields through", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
  });

  it("renders null/undefined as empty", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes commas, quotes, and newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
    expect(csvEscape("cr\rlf")).toBe('"cr\rlf"');
  });
});

describe("toCsvRow", () => {
  it("joins with commas and ends with CRLF", () => {
    expect(toCsvRow(["a", "b,c", 1])).toBe('a,"b,c",1\r\n');
  });
});
