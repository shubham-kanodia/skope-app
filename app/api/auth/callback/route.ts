import { NextResponse } from "next/server";
import { consumeMagicLink } from "@/lib/auth/magic-link";
import { findOrCreateUserByEmail } from "@/lib/orgs/users";
import { createSession } from "@/lib/auth/session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const loginUrl = new URL("/login", url.origin);

  if (!token) {
    loginUrl.searchParams.set("error", "missing");
    return NextResponse.redirect(loginUrl);
  }

  const consumed = await consumeMagicLink(token);
  if (!consumed) {
    // Expired, already used, or wrong, all map to the same friendly retry.
    loginUrl.searchParams.set("error", "expired");
    return NextResponse.redirect(loginUrl);
  }
  const { email, refCode } = consumed;

  let isNew = false;
  try {
    const resolved = await findOrCreateUserByEmail(email, refCode);
    isNew = resolved.isNew;
    await createSession({
      userId: resolved.userId,
      orgId: resolved.orgId,
      email,
      role: resolved.role,
    });
  } catch (err) {
    console.error("[auth/callback] failed to establish session", err);
    loginUrl.searchParams.set("error", "server");
    return NextResponse.redirect(loginUrl);
  }

  // The dashboard reads this once for analytics (sign_up vs login), then strips it.
  const dashboardUrl = new URL("/dashboard", url.origin);
  dashboardUrl.searchParams.set("auth", isNew ? "signup" : "login");
  return NextResponse.redirect(dashboardUrl);
}
