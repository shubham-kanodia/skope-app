import { describe, expect, it } from "vitest";
import { renderNoticeHtml } from "./notice-html";

describe("renderNoticeHtml", () => {
  it("renders title, intro paragraphs, and sections", () => {
    const html = renderNoticeHtml(
      {
        title: "Privacy notice",
        intro: "First para.\n\nSecond para.",
        sections: [{ heading: "Who we are", body: "We run the site.\n\n- item line\nwrapped" }],
      },
      { domain: "acme.in", version: 3, publishedAt: "2026-06-01", checksum: "abc123" },
    );
    expect(html).toContain("<h1>Privacy notice</h1>");
    expect(html).toContain("<p>First para.</p>");
    expect(html).toContain("<p>Second para.</p>");
    expect(html).toContain("<h2>Who we are</h2>");
    expect(html).toContain("version 3");
    expect(html).toContain("abc123");
    // Single newlines inside a paragraph become <br>.
    expect(html).toContain("- item line<br>wrapped");
  });

  it("escapes HTML in user-controlled content", () => {
    const html = renderNoticeHtml(
      {
        title: '<script>alert("x")</script>',
        intro: "a & b < c",
        sections: [{ heading: "H", body: "B" }],
      },
      { domain: "<evil>", version: 1, publishedAt: null },
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b &lt; c");
    expect(html).toContain("&lt;evil&gt;");
  });
});
