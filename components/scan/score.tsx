import type { FindingStatus } from "@/lib/scan/analyze";

export type Band = "on_track" | "needs_work" | "at_risk";

export const BAND_META: Record<Band, { label: string; color: string }> = {
  on_track: { label: "On track", color: "var(--success)" },
  needs_work: { label: "Needs work", color: "var(--amber)" },
  at_risk: { label: "At risk", color: "#cf202f" },
};

export function ScoreRing({ score, band, size = 132 }: { score: number; band: Band; size?: number }) {
  const meta = BAND_META[band];
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--hairline)" strokeWidth="8" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={meta.color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-3xl text-ink">{score}</span>
        <span className="text-xs text-muted">/ 100</span>
      </div>
    </div>
  );
}

export function StatusIcon({ status }: { status: FindingStatus }) {
  const color = status === "pass" ? "var(--success)" : status === "warn" ? "var(--amber)" : "#cf202f";
  return (
    <span
      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      aria-label={status}
    >
      {status === "pass" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" aria-hidden>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      ) : status === "warn" ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 7v6" />
          <path d="M12 17h.01" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      )}
    </span>
  );
}
