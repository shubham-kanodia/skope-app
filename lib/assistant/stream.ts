/**
 * Streamed chat completion via OpenRouter (same endpoint/headers as
 * lib/policy/generate.ts, but stream: true). Parses the upstream SSE framing
 * and re-emits plain UTF-8 text chunks, so the client just reads text.
 */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Extract delta text chunks from an OpenAI-style SSE byte stream. */
export async function* sseDeltas(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by a blank line; keep the trailing partial.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        for (const line of event.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload) as { choices?: { delta?: { content?: string } }[] };
            const text = json.choices?.[0]?.delta?.content;
            if (text) yield text;
          } catch {
            // Ignore malformed keep-alives.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Run the chat and return a plain-text ReadableStream, or null when the API
 * key is unset or the upstream call fails (the route turns null into a 503).
 */
export async function streamChat(messages: ChatMessage[]): Promise<ReadableStream<Uint8Array> | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  let res: Response;
  try {
    res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://skope.network",
        "X-Title": "Skope DPDP",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        temperature: 0.4,
        stream: true,
        messages,
      }),
    });
  } catch (err) {
    console.error("[assistant] OpenRouter request failed", err);
    return null;
  }

  if (!res.ok || !res.body) {
    console.error("[assistant] OpenRouter error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    return null;
  }

  const deltas = sseDeltas(res.body);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await deltas.next();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(value));
    },
    async cancel() {
      await deltas.return(undefined);
    },
  });
}
