import { randomBytes, createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { sendEmail } from "@/lib/email/send";

const TTL_MINUTES = 15;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Create a single-use, 15-minute login token and email the link.
 * Only the SHA-256 hash is stored; the raw token lives only in the email.
 */
export async function requestMagicLink(emailRaw: string, refCode?: string | null): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES * 60 * 1000);
  const ref = refCode ? refCode.trim().toLowerCase().slice(0, 32) : null;

  await sql`
    insert into login_tokens (email, token_hash, expires_at, ref_code)
    values (${email}, ${hashToken(token)}, ${expiresAt}, ${ref})`;

  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = `${base}/api/auth/callback?token=${token}`;

  await sendEmail({
    to: email,
    subject: "Your Skope sign-in link",
    text: `Sign in to Skope:\n${url}\n\nThis link works once and expires in ${TTL_MINUTES} minutes. If you didn't ask for it, ignore this email.`,
    html: linkEmailHtml(url),
  });
}

/**
 * Consume a token atomically. The single UPDATE…WHERE consumed_at IS NULL
 * guarantees one-time use even under concurrent clicks. Returns the email or null.
 */
export interface ConsumedToken {
  email: string;
  refCode: string | null;
}

export async function consumeMagicLink(token: string): Promise<ConsumedToken | null> {
  const rows = await sql`
    update login_tokens
       set consumed_at = now()
     where token_hash = ${hashToken(token)}
       and consumed_at is null
       and expires_at > now()
    returning email, ref_code`;
  if (!rows[0]) return null;
  return { email: rows[0].email as string, refCode: (rows[0].ref_code as string | null) ?? null };
}

function linkEmailHtml(url: string): string {
  return `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0b0d;line-height:1.5">
    <p>Sign in to Skope:</p>
    <p><a href="${url}" style="display:inline-block;background:#0052ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:100px">Sign in</a></p>
    <p style="color:#5b616e;font-size:14px">This link works once and expires in ${TTL_MINUTES} minutes. If you didn't ask for it, ignore this email.</p>
  </body></html>`;
}
