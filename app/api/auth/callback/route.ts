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

  try {
    const { userId, orgId, role } = await findOrCreateUserByEmail(email, refCode);
    await createSession({ userId, orgId, email, role });
  } catch (err) {
    console.error("[auth/callback] failed to establish session", err);
    loginUrl.searchParams.set("error", "server");
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
