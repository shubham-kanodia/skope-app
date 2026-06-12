"use client";

import { useId, useState } from "react";
import { glossary, type GlossaryTerm } from "@/lib/glossary";

/**
 * Accessible tooltip. Opens on hover AND focus (keyboard-friendly) and on tap
 * (the trigger is a real button). Use <Tooltip term="purpose"> for glossary
 * or pass `content` for one-off hints.
 */
export function Tooltip({
  term,
  content,
  children,
  label = "What's this?",
}: {
  term?: GlossaryTerm;
  content?: string;
  children?: React.ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const text = content ?? (term ? glossary[term] : "");

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-hairline text-[10px] font-medium text-muted hover:border-primary hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {children ?? "?"}
      </button>
      {open && text && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-hairline bg-canvas px-3 py-2 text-left text-[13px] leading-relaxed text-body shadow-[0_4px_12px_rgba(0,0,0,0.08)]"
        >
          {text}
        </span>
      )}
    </span>
  );
}
