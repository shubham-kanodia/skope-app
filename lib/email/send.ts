/**
 * Transactional email via Maileroo (https://maileroo.com/docs/email-api).
 * When MAILEROO_SENDING_KEY is unset (local dev before infra), it logs to the
 * console so the auth/request flows still work end-to-end, the link prints to
 * the terminal.
 */
export interface OutboundEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const MAILEROO_ENDPOINT = "https://smtp.maileroo.com/api/v2/emails";

/** Parse "Display Name <addr@domain>" (or a bare address) into Maileroo's shape. */
function parseSender(raw: string): { address: string; display_name?: string } {
  const m = raw.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m) {
    const display_name = m[1].trim();
    return display_name ? { address: m[2].trim(), display_name } : { address: m[2].trim() };
  }
  return { address: raw.trim() };
}

export async function sendEmail({ to, subject, html, text }: OutboundEmail): Promise<void> {
  const key = process.env.MAILEROO_SENDING_KEY;
  const from = process.env.EMAIL_FROM ?? "Skope <login@skope.network>";

  if (!key) {
    console.log(
      `\n[email] not sent (MAILEROO_SENDING_KEY unset)\n  to: ${to}\n  subject: ${subject}\n  ${text.replace(/\n/g, "\n  ")}\n`,
    );
    return;
  }

  const res = await fetch(MAILEROO_ENDPOINT, {
    method: "POST",
    headers: { "X-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: parseSender(from),
      to: [{ address: to }],
      subject,
      html,
      plain: text,
    }),
  });

  // Maileroo returns 200 with { success: boolean, message }, check both the
  // HTTP status and the success flag.
  let body: { success?: boolean; message?: string } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok || body.success === false) {
    throw new Error(`Maileroo send failed: ${res.status} ${body.message ?? ""}`.trim());
  }
}
