/**
 * Google Cloud Translation API (v2 REST). Server-side only — the API key never
 * reaches the browser. Translates a batch of strings in one request, order
 * preserved. Throws a friendly error when the key is missing.
 */
const ENDPOINT = "https://translation.googleapis.com/language/translate/v2";

export async function translateBatch(
  texts: string[],
  target: string,
  source: string,
): Promise<string[]> {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (!key) {
    throw new Error("Auto-translate isn't configured. Set GOOGLE_TRANSLATE_API_KEY.");
  }
  if (texts.length === 0) return [];

  const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texts, target, source, format: "text" }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Translation failed (${res.status}). ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    data?: { translations?: { translatedText: string }[] };
  };
  const out = data.data?.translations?.map((t) => decodeEntities(t.translatedText));
  if (!out || out.length !== texts.length) {
    throw new Error("Translation returned an unexpected response.");
  }
  return out;
}

// Google sometimes returns HTML entities even with format=text; decode the common ones.
function decodeEntities(s: string): string {
  return s
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
