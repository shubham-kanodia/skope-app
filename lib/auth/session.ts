import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE = "skope_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set. See .env.example.");
  return new TextEncoder().encode(s);
}

export type UserRole = "owner" | "admin" | "viewer";

export interface Session {
  userId: string;
  orgId: string;
  email: string;
  role: UserRole;
}

/** Issue a signed session cookie. Call only from route handlers / server actions. */
export async function createSession(s: Session): Promise<void> {
  const token = await new SignJWT({ orgId: s.orgId, email: s.email, role: s.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(s.userId)
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Read the current session (or null). Safe to call from Server Components. */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub || typeof payload.orgId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    // Older sessions predate roles; treat them as owner (the single-user case).
    const role = payload.role === "admin" || payload.role === "viewer" ? payload.role : "owner";
    return { userId: payload.sub, orgId: payload.orgId, email: payload.email, role };
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}
