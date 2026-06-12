import type { PolicyContent } from "./types";

/**
 * Strip markdown remnants from model output. Notice bodies render as plain
 * text (components/public/public-shell.tsx Prose), so stray markdown shows up
 * literally on the page. The prompt forbids it; this is the guarantee.
 */
export function stripMarkdown(text: string): string {
  return (
    text
      // **bold** / __bold__ → bare text
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/__(.+?)__/g, "$1")
      // "* item" / "+ item" / "• item" bullets → "- item"
      .replace(/^(\s*)[*+•]\s+/gm, "$1- ")
      // "# Heading" → "Heading"
      .replace(/^#{1,6}\s+/gm, "")
      // [text](url) → text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  );
}

export function sanitizePolicyContent(content: PolicyContent): PolicyContent {
  return {
    title: stripMarkdown(content.title),
    intro: stripMarkdown(content.intro),
    sections: content.sections.map((s) => ({
      heading: stripMarkdown(s.heading),
      body: stripMarkdown(s.body),
    })),
  };
}
