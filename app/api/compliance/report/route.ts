import { NextResponse } from "next/server";
import { attachEmail } from "@/lib/scan/store";
import { sendEmail } from "@/lib/email/send";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Capture the lead's email and send them a link to the full report. */
export async function POST(request: Request) {
  let body: { token?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const token = String(body.token ?? "");
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!token) return NextResponse.json({ error: "Missing scan." }, { status: 400 });
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "That email doesn't look right. Check it and try again." },
      { status: 400 },
    );
  }

  const domain = await attachEmail(token, email);
  if (!domain) {
    return NextResponse.json({ error: "That scan has expired. Run it again." }, { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/compliance-checker/report/${token}`;

  try {
    await sendEmail({
      to: email,
      subject: `Your DPDP compliance report for ${domain}`,
      text: `Your DPDP compliance report for ${domain} is ready:\n${url}\n\nIt lists what's working, what's missing, and how to fix each gap. Skope can make ${domain} compliant in about 30 minutes.`,
      html: reportEmailHtml(domain, url),
    });
  } catch (err) {
    console.error("[compliance] failed to send report email", err);
    return NextResponse.json(
      { error: "We saved your report but couldn't email it. Open it here instead.", url },
      { status: 200 },
    );
  }

  return NextResponse.json({ ok: true, url });
}

function reportEmailHtml(domain: string, url: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0b0d;line-height:1.5">
    <p>Your DPDP compliance report for <strong>${domain}</strong> is ready.</p>
    <p><a href="${url}" style="display:inline-block;background:#0052ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:100px">View your report</a></p>
    <p style="color:#5b616e;font-size:14px">It lists what's working, what's missing, and how to fix each gap. Skope can make ${domain} compliant in about 30 minutes.</p>
  </body></html>`;
}
