import { NextResponse } from "next/server";
import { normalizeDomain } from "@/lib/domain";
import { analyzeSite } from "@/lib/scan/analyze";
import { createScan } from "@/lib/scan/store";
import { rateLimit } from "@/lib/rate-limit";
import { clientIpTruncated } from "@/lib/consent/request-meta";

export const runtime = "nodejs";

/** Public, unauthenticated DPDP compliance scan. Returns a teaser summary + token. */
export async function POST(request: Request) {
  let body: { domain?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const domain = normalizeDomain(body.domain ?? "");
  if (!domain) {
    return NextResponse.json(
      { error: "That domain doesn't look right. Try something like yourstore.in." },
      { status: 400 },
    );
  }

  const ip = clientIpTruncated(request.headers) ?? "noip";
  const rl = await rateLimit(`scan:${ip}`, 5, 3600); // 5 scans / IP / hour
  if (!rl.ok) {
    return NextResponse.json(
      { error: "You've run a few scans already. Try again in an hour." },
      { status: 429 },
    );
  }

  let report;
  try {
    report = await analyzeSite(domain);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "We couldn't reach that site." },
      { status: 400 },
    );
  }

  let token: string;
  try {
    token = await createScan(report);
  } catch (err) {
    console.error("[compliance] failed to store scan", err);
    return NextResponse.json({ error: "Something broke on our side. Try again." }, { status: 500 });
  }

  // Teaser: score + per-check status, but withhold the detailed fixes (those go in the emailed report).
  return NextResponse.json({
    token,
    domain: report.domain,
    score: report.score,
    band: report.band,
    trackerCount: report.trackers.length,
    checks: report.findings.map((f) => ({ title: f.title, status: f.status })),
  });
}
