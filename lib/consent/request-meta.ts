import { createHash } from "node:crypto";

/**
 * Extract privacy-preserving request metadata. We NEVER store a full IP, DPDP
 * data-minimization, only a /24 (IPv4) or /64 (IPv6) prefix for abuse triage.
 */
export function clientIpTruncated(headers: Headers): string | null {
  const raw =
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip");
  if (!raw) return null;

  if (raw.includes(":")) {
    // IPv6 → keep the first 4 hextets (/64).
    const groups = raw.split(":").slice(0, 4).join(":");
    return `${groups}::/64`;
  }
  const octets = raw.split(".");
  if (octets.length !== 4) return null;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

/** Country from the Cloudflare edge header, if present. */
export function edgeCountry(headers: Headers): string | null {
  const c = headers.get("cf-ipcountry");
  return c && c.length === 2 ? c.toUpperCase() : null;
}

/**
 * The origin of the page that made this request, used to record where skope.js
 * is actually running. Prefers the Origin header; falls back to the Referer's
 * origin. Returns null for file:// pages (Origin: "null").
 */
export function requestOrigin(headers: Headers): string | null {
  const origin = headers.get("origin");
  if (origin && origin !== "null") return origin;
  const referer = headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      /* malformed referer */
    }
  }
  return null;
}

/** Hash the user agent, useful for audit correlation, not for fingerprinting. */
export function userAgentHash(headers: Headers): string | null {
  const ua = headers.get("user-agent");
  if (!ua) return null;
  return createHash("sha256").update(ua).digest("hex").slice(0, 32);
}
