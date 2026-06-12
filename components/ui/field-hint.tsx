/** One-line helper text under a form field. Brand voice: plain, short. */
export function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{children}</p>;
}
