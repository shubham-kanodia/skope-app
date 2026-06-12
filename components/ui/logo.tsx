import Image from "next/image";

/**
 * The Skope logo: logo.png mark + "skope" wordmark.
 * tone="light" on white surfaces, tone="dark" on dark bands.
 */
export function Logo({
  tone = "light",
  size = 24,
  className,
}: {
  tone?: "light" | "dark";
  size?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <Image src="/logo.png" alt="" width={size} height={size} priority />
      <span
        className={`text-[17px] font-semibold tracking-tight ${
          tone === "dark" ? "text-white" : "text-ink"
        }`}
      >
        skope
      </span>
    </span>
  );
}
