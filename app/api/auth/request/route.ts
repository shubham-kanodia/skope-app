import { NextResponse } from "next/server";
import { requestMagicLink } from "@/lib/auth/magic-link";
import { createSession } from "@/lib/auth/session";
import { findOrCreateUserByEmail } from "@/lib/orgs/users";
import { isTestLoginAllowed, isTestLoginEmail } from "@/lib/auth/test-login";

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

  // Test login (gated): the one designated test account signs in directly,
  // skipping the magic-link email. Off unless ALLOW_TEST_LOGIN=true.
  if (isTestLoginAllowed() && isTestLoginEmail(email)) {
    try {
      const resolved = await findOrCreateUserByEmail(email, ref);
      await createSession({
        userId: resolved.userId,
        orgId: resolved.orgId,
        email,
        role: resolved.role,
      });
      return NextResponse.json({ ok: true, redirect: "/dashboard" });
    } catch (err) {
      console.error("[auth/request] test login failed", err);
      return NextResponse.json({ error: "Test login failed." }, { status: 500 });
    }
  }

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
