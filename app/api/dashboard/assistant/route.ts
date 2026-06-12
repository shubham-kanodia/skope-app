import { getSession } from "@/lib/auth/session";
import { rateLimit } from "@/lib/rate-limit";
import { buildOrgContext } from "@/lib/assistant/context";
import { PRODUCT_CONTEXT } from "@/lib/assistant/product-context";
import { SYSTEM_PROMPT } from "@/lib/assistant/prompt";
import { streamChat, type ChatMessage } from "@/lib/assistant/stream";

export const runtime = "nodejs";

const MAX_MESSAGES = 12;
const MAX_CHARS = 4000;

/**
 * Streaming compliance assistant for dashboard users. Conversations are not
 * stored server-side (the client keeps them in sessionStorage); each request
 * re-grounds the model with the org's live compliance state.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const [hourly, burst] = await Promise.all([
    rateLimit(`assistant:${session.orgId}`, 30, 3600),
    rateLimit(`assistant-burst:${session.orgId}`, 6, 60),
  ]);
  if (!hourly.ok || !burst.ok) {
    return Response.json(
      { error: "The assistant needs a short breather. Try again in a minute." },
      { status: 429 },
    );
  }

  let body: { messages?: unknown };
  try {
    body = (await request.json()) as { messages?: unknown };
  } catch {
    return Response.json({ error: "Send a JSON body with messages." }, { status: 400 });
  }

  const messages = coerceMessages(body.messages);
  if (!messages) {
    return Response.json({ error: "Ask a question to get started." }, { status: 400 });
  }

  const orgContext = await buildOrgContext(session.orgId);
  const stream = await streamChat([
    {
      role: "system",
      content: `${SYSTEM_PROMPT}\n\n${PRODUCT_CONTEXT}\n\nToday's date: ${new Date().toISOString().slice(0, 10)}\n\nCustomer's current state in Skope:\n${orgContext}`,
    },
    ...messages,
  ]);
  if (!stream) {
    return Response.json({ error: "The assistant isn't available right now." }, { status: 503 });
  }

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** Clamp untrusted chat history: roles whitelisted, last 12, 4k chars each. */
function coerceMessages(raw: unknown): ChatMessage[] | null {
  if (!Array.isArray(raw)) return null;
  const out: ChatMessage[] = [];
  for (const v of raw) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    if (r.role !== "user" && r.role !== "assistant") continue;
    if (typeof r.content !== "string" || !r.content.trim()) continue;
    out.push({ role: r.role, content: r.content.slice(0, MAX_CHARS) });
  }
  const recent = out.slice(-MAX_MESSAGES);
  return recent.length > 0 && recent[recent.length - 1].role === "user" ? recent : null;
}
