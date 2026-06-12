/**
 * The aperture iris, Skope's brand motif (see BRAND.md).
 *
 * Geometry: N blades, each the region between a chord and the outer circle.
 * Every chord is tangent to an inner circle of radius `h`; the union of the
 * blades leaves a regular N-gon hole of inradius `h`. h = 0 → fully closed.
 */

export const BLADE_COUNT = 7;

export function bladePaths(
  open: number,
  cx: number,
  cy: number,
  R: number,
  maxHole: number,
  n: number = BLADE_COUNT,
): string[] {
  const h = Math.max(0, Math.min(1, open)) * maxHole;
  const t = Math.sqrt(R * R - h * h);
  const phi = Math.atan2(t, h);
  const paths: string[] = [];
  for (let i = 0; i < n; i++) {
    const theta = (i * 2 * Math.PI) / n;
    const p1x = cx + R * Math.cos(theta + phi);
    const p1y = cy + R * Math.sin(theta + phi);
    const p2x = cx + R * Math.cos(theta - phi);
    const p2y = cy + R * Math.sin(theta - phi);
    paths.push(
      `M ${p1x.toFixed(2)} ${p1y.toFixed(2)} L ${p2x.toFixed(2)} ${p2y.toFixed(2)} A ${R} ${R} 0 0 1 ${p1x.toFixed(2)} ${p1y.toFixed(2)} Z`,
    );
  }
  return paths;
}

const TONES = {
  dark: { ring: "rgba(255,255,255,0.16)", blade: "#16181c", edge: "#3c7dff" },
  light: { ring: "#dee1e6", blade: "#eef0f3", edge: "#0052ff" },
};

/** Static aperture mark, logo, dividers, favicon source. */
export function ApertureMark({
  open = 0.55,
  size = 24,
  tone = "dark",
  className,
}: {
  open?: number;
  size?: number;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  const paths = bladePaths(open, 50, 50, 46, 30);
  const c = TONES[tone];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={className}
    >
      <circle cx="50" cy="50" r="46" fill="none" stroke={c.ring} strokeWidth="3" />
      {paths.map((d, i) => (
        <path key={i} d={d} fill={c.blade} stroke={c.edge} strokeWidth="1.5" />
      ))}
    </svg>
  );
}
