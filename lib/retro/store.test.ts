import { describe, expect, it } from "vitest";
import { parseEmailList } from "./parse";

describe("parseEmailList", () => {
  it("splits on newlines, commas, semicolons, and spaces", () => {
    expect(parseEmailList("a@x.com\nb@y.com, c@z.com; d@w.com e@v.com")).toEqual([
      "a@x.com",
      "b@y.com",
      "c@z.com",
      "d@w.com",
      "e@v.com",
    ]);
  });

  it("lowercases and de-duplicates", () => {
    expect(parseEmailList("A@X.com\na@x.com")).toEqual(["a@x.com"]);
  });

  it("drops invalid addresses", () => {
    expect(parseEmailList("good@x.com\nnope\n@bad\nalso bad@")).toEqual(["good@x.com"]);
  });

  it("returns empty for junk", () => {
    expect(parseEmailList("")).toEqual([]);
    expect(parseEmailList("not an email at all")).toEqual([]);
  });
});
