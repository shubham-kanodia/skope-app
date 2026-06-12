import type { PolicyContent } from "@/lib/policy/types";

/**
 * Standalone HTML render of a published notice version for the audit bundle —
 * a regulator can open it with no app running. Same paragraph-split convention
 * as the public privacy page (blank line = new paragraph).
 */
export function renderNoticeHtml(content: PolicyContent, meta: {
  domain: string;
  version: number;
  publishedAt: string | null;
  checksum?: string | null;
}): string {
  const paras = (text: string) =>
    text
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
      .join("\n");

  const sections = content.sections
    .map((s) => `<section>\n<h2>${esc(s.heading)}</h2>\n${paras(s.body)}\n</section>`)
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(content.title)} — ${esc(meta.domain)} (v${meta.version})</title>
<style>
body { font: 16px/1.6 system-ui, sans-serif; max-width: 68ch; margin: 3rem auto; padding: 0 1rem; color: #1a1d24; }
h1 { font-size: 1.6rem; line-height: 1.2; }
h2 { font-size: 1.15rem; margin-top: 2rem; }
.meta { color: #6b7280; font-size: .85rem; }
</style>
</head>
<body>
<p class="meta">Privacy notice for ${esc(meta.domain)} — version ${meta.version}${
    meta.publishedAt ? `, published ${esc(meta.publishedAt)}` : ""
  }${meta.checksum ? `<br>Checksum (SHA-256): ${esc(meta.checksum)}` : ""}</p>
<h1>${esc(content.title)}</h1>
${content.intro ? paras(content.intro) : ""}
${sections}
</body>
</html>
`;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
