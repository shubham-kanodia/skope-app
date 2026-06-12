import { NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth/magic-link";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  let body: { email?: string; ref?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json(
      { error: "That email doesn't look right. Check it and try again." },
      { status: 400 },
    );
  }
  const ref = typeof body.ref === "string" ? body.ref : null;

  try {
    await requestMagicLink(email, ref);
  } catch (err) {
    console.error("[auth/request] failed to send magic link", err);
    return NextResponse.json(
      { error: "We couldn't send the link. Try again in a minute." },
      { status: 500 },
    );
  }

  // Always report success regardless of whether the address exists, no account enumeration.
  return NextResponse.json({ ok: true });
}
