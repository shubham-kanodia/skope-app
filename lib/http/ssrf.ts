import { lookup } from "node:dns/promises";

/**
 * SSRF guard for server-side fetches of user-supplied URLs (install verify,
 * site scanner). Only http/https, and the resolved IP must be public, blocks
 * localhost, private ranges, link-local, and cloud metadata addresses.
 */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https URLs are allowed.");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That address isn't reachable from the public internet.");
  }

  let address: string;
  try {
    ({ address } = await lookup(host));
  } catch {
    throw new Error("We couldn't resolve that domain, is it live and public?");
  }
  if (isPrivateIp(address)) {
    throw new Error("That address isn't reachable from the public internet.");
  }
  return url;
}

export function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const a = ip.toLowerCase();
    return (
      a === "::1" ||
      a === "::" ||
      a.startsWith("fc") ||
      a.startsWith("fd") || // unique-local fc00::/7
      a.startsWith("fe8") ||
      a.startsWith("fe9") ||
      a.startsWith("fea") ||
      a.startsWith("feb") // link-local fe80::/10
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // unknown → treat as unsafe
  const [a, b] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) || // link-local + AWS metadata 169.254.169.254
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224 // multicast/reserved
  );
}
