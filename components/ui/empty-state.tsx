/** Empty state that invites the next action in one line (BRAND.md). */
export function EmptyState({
  title,
  hint,
  action,
  illustration,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  /** Brand mark or icon shown above the title, where the screen needs personality most. */
  illustration?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-hairline bg-surface-soft px-6 py-14 text-center">
      {illustration && (
        <div className="mb-5 flex justify-center" aria-hidden>
          {illustration}
        </div>
      )}
      <p className={illustration ? "text-lg text-ink" : "text-ink"}>{title}</p>
      {hint && <p className="mx-auto mt-1.5 max-w-md text-sm text-body">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
