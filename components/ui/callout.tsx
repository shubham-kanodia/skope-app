/** Inline info / warning / success callout. Quiet by default per DESIGN.md. */
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "warn" | "success";
  title?: string;
  children: React.ReactNode;
}) {
  const accent =
    tone === "warn"
      ? "border-l-amber"
      : tone === "success"
        ? "border-l-success"
        : "border-l-primary";
  return (
    <div
      className={`rounded-xl border border-hairline ${accent} border-l-2 bg-surface-soft px-4 py-3 text-sm`}
    >
      {title && <p className="font-medium text-ink">{title}</p>}
      <div className={title ? "mt-0.5 text-body" : "text-body"}>{children}</div>
    </div>
  );
}
