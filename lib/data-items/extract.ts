import { DATA_ITEM_CATEGORIES, type DataItemCategory } from "./types";

/**
 * Read a screenshot of a form and suggest the personal-data fields it collects,
 * using the same OpenRouter conventions as lib/policy/generate.ts (the default
 * Gemini flash model accepts images). The image lives only in this request's
 * memory, it is sent to the model once and never persisted anywhere.
 *
 * Unlike policy generation there is no template fallback for vision: when the
 * key is unset or the call fails we return null and the UI routes the user to
 * manual entry.
 */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export interface ExtractedField {
  name: string;
  category: DataItemCategory;
  purposeKey: string;
}

const SYSTEM_PROMPT = `You are helping a website owner comply with India's DPDP Act by listing the personal data their form collects.

Look at the screenshot of a web form. List every field that collects personal data (name, email, phone, address, date of birth, PAN, Aadhaar, payment details, and similar). Ignore buttons, captchas, passwords, and fields that collect no personal data.

Return ONLY a JSON object, no prose, with this exact shape:
{ "items": [ { "name": string, "category": string, "purpose": string }, ... ] }

- "name": a short plain-English label for the data, e.g. "Email address" (not the raw field placeholder)
- "category": one of "identity", "contact", "financial", "official_id", "usage", "other"
- "purpose": one of "necessary", "analytics", "marketing", your best guess at why the form collects it ("necessary" for anything needed to deliver the service)`;

export async function extractFieldsFromImage(image: {
  mime: string;
  base64: string;
}): Promise<ExtractedField[] | null> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;

  try {
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://skope.network",
        "X-Title": "Skope DPDP",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "List the personal-data fields this form collects." },
              { type: "image_url", image_url: { url: `data:${image.mime};base64,${image.base64}` } },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[data-items] OpenRouter error", res.status, (await res.text()).slice(0, 300));
      return null;
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    return raw ? coerceExtracted(safeJson(raw)) : null;
  } catch (err) {
    console.error("[data-items] extraction failed", err);
    return null;
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

const PURPOSES = new Set(["necessary", "analytics", "marketing"]);

function coerceExtracted(raw: unknown): ExtractedField[] | null {
  if (!raw || typeof raw !== "object") return null;
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return null;

  const out: ExtractedField[] = [];
  const seen = new Set<string>();
  for (const v of items.slice(0, 40)) {
    if (!v || typeof v !== "object") continue;
    const r = v as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 80) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const category = DATA_ITEM_CATEGORIES.includes(r.category as DataItemCategory)
      ? (r.category as DataItemCategory)
      : "other";
    const purposeKey = typeof r.purpose === "string" && PURPOSES.has(r.purpose) ? r.purpose : "necessary";
    out.push({ name, category, purposeKey });
  }
  return out.length > 0 ? out : null;
}
