import { describe, expect, it } from "vitest";
import { stripMarkdown } from "./sanitize";

describe("stripMarkdown", () => {
  it("unwraps bold", () => {
    expect(stripMarkdown("Your **name** and __email__")).toBe("Your name and email");
  });

  it("normalises bullet styles to '- '", () => {
    expect(stripMarkdown("* Name\n+ Email\n• Phone\n- PAN")).toBe("- Name\n- Email\n- Phone\n- PAN");
  });

  it("keeps indentation on bullets", () => {
    expect(stripMarkdown("  * nested")).toBe("  - nested");
  });

  it("strips heading hashes", () => {
    expect(stripMarkdown("## What we collect\nbody")).toBe("What we collect\nbody");
  });

  it("unwraps links", () => {
    expect(stripMarkdown("see [our policy](https://x.in/p)")).toBe("see our policy");
  });

  it("leaves plain text and legit dashes alone", () => {
    const clean = "We keep data 365 days.\n\n- Email address, to contact you";
    expect(stripMarkdown(clean)).toBe(clean);
  });

  it("does not mangle mid-sentence asterisks used as footnotes", () => {
    expect(stripMarkdown("rates from 2%* apply")).toBe("rates from 2%* apply");
  });
});
