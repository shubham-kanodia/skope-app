import { coercePolicyContent, type PolicyContent, type PolicyInput } from "./types";
import { sanitizePolicyContent } from "./sanitize";
import { templatePolicy } from "./template";
import { DPB_COMPLAINT_CHANNEL } from "./dpb-channel";

/**
 * Draft a DPDP privacy notice. Uses OpenRouter's OpenAI-compatible chat
 * completions (a Gemini flash model by default) when OPENROUTER_API_KEY is set;
 * otherwise (and on any failure) falls back to a deterministic template built
 * from the site's own data, so local dev and CI never depend on the API.
 *
 * The model is instructed to return strict JSON matching PolicyContent. We
 * always validate, and fall back to the template if the response is unusable.
 */
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export async function generatePolicyDraft(input: PolicyInput): Promise<{ content: PolicyContent; source: "ai" | "template" }> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) {
    console.log("[policy] OPENROUTER_API_KEY unset, using template draft");
    return { content: templatePolicy(input), source: "template" };
  }

  try {
    const model = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        // Optional attribution headers OpenRouter recommends.
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "https://skope.network",
        "X-Title": "Skope DPDP",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt(input) },
        ],
      }),
    });

    if (!res.ok) {
      console.error("[policy] OpenRouter error", res.status, (await res.text()).slice(0, 300));
      return { content: templatePolicy(input), source: "template" };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    const parsed = raw ? safeJson(raw) : null;
    const content = coercePolicyContent(parsed);
    if (!content) {
      console.error("[policy] OpenRouter returned unusable JSON, falling back to template");
      return { content: templatePolicy(input), source: "template" };
    }
    return { content: sanitizePolicyContent(content), source: "ai" };
  } catch (err) {
    console.error("[policy] generation failed, using template", err);
    return { content: templatePolicy(input), source: "template" };
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    // Some models wrap JSON in code fences; strip and retry.
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

const SYSTEM_PROMPT = `You are a privacy lawyer drafting a website privacy notice that complies with India's Digital Personal Data Protection Act, 2023 (DPDP) and its Rules.

Write in plain, clear English (sentence case, no exclamation marks, no legalese where simpler words work). The reader is an ordinary website visitor.

You MUST return ONLY a JSON object, no prose around it, with this exact shape:
{
  "title": string,
  "intro": string,
  "sections": [ { "heading": string, "body": string }, ... ]
}

FORMATTING, section bodies are rendered as PLAIN TEXT, never markdown:
- No markdown of any kind: no asterisks, no **bold**, no # headings, no [links], no tables. Markdown characters appear literally on the page and look broken.
- A list is consecutive lines each starting with "- " (dash, space). Nothing else.
- Separate paragraphs with one blank line.
- List items are ONE line each, compact. Do not expand an item into sub-fields like "What it is:" / "Purpose:" / "Retention:", fold the facts you were given into the single line and stop.
- State only facts provided by the user. If a retention period or source was not given for an item, leave it out of that line; never fill the gap with generic wording like "as long as necessary to fulfil the purpose".

Example of a correct data list:
- Email address, to contact you (collected at the signup form, kept about 365 days)
- PAN, for identity verification (collected at the KYC form)

Example of a correct tracker list:
- Google Analytics 4 (analytics), blocked until you consent

Cover at least these sections, using the facts provided by the user (do not invent purposes, trackers, retention periods, or contact details, and where a contact detail is missing write "[HUMAN: add ...]"):
1. Who we are (the Data Fiduciary)
2. What data we collect and why (a short lead-in paragraph, then one "- " line per personal data item in the style above, then the purposes; state that strictly necessary processing needs no consent and everything else relies on the visitor's consent)
3. Cookies and trackers (one "- " line per tracker; note they are blocked until consent)
4. How long we keep data (retention; mention deletion on consent withdrawal)
5. Your rights under DPDP and how to use them (access, correction, erasure, nomination, withdraw consent; tell them to use the privacy preferences page; mention the response window)
6. Grievance redressal (the grievance officer's contact, and the DPO if provided)
7. Complaints to the Data Protection Board of India
8. Children's data (no processing of under-18 data without verifiable parental consent; no tracking or targeted ads to children)
9. Changes to this notice

Do not number the section headings, write them as plain titles like "Who we are". Keep each body to a few short paragraphs.`;

function userPrompt(input: PolicyInput): string {
  const purposes = input.purposes
    .map((p) => `- ${p.name} [${p.isEssential ? "essential" : "consent-based"}]: ${p.description}${p.retentionDays ? ` (retained ~${p.retentionDays} days)` : ""}`)
    .join("\n");
  const trackers = input.trackers.length
    ? input.trackers.map((t) => `- ${t.name} (${t.category})`).join("\n")
    : "- none detected";
  const dataItems = input.dataItems.length
    ? input.dataItems
        .map(
          (d) =>
            `- ${d.name} (${d.category}) for ${d.purpose}${d.source ? `, collected at ${d.source}` : ""}${d.retentionDays ? `, kept ~${d.retentionDays} days` : ""}`,
        )
        .join("\n")
    : "- none declared";
  return [
    `Organisation: ${input.orgName || input.domain}`,
    `Website: ${input.domain}`,
    `Response window for rights requests: ${input.responseDays} days`,
    ``,
    `Personal data collected:`,
    dataItems,
    ``,
    `Purposes:`,
    purposes,
    ``,
    `Trackers / cookies:`,
    trackers,
    ``,
    `Grievance officer:`,
    `- Name: ${input.grievanceName || "[missing]"}`,
    `- Email: ${input.grievanceEmail || "[missing]"}`,
    `- Phone: ${input.grievancePhone || "[none]"}`,
    `- Address: ${input.grievanceAddress || "[none]"}`,
    ``,
    `Data Protection Officer:`,
    `- Name: ${input.dpoName || "[none]"}`,
    `- Email: ${input.dpoEmail || "[none]"}`,
    ``,
    `Recipients we share data with (DPDP §11(1)(b)), include a "Who we share your data with" section listing these, and an "International transfers" section if any are outside India (§16):`,
    input.recipients.length
      ? input.recipients
          .map((r) => `- ${r.name} (${r.role}${r.country ? `, ${r.country}` : ""})${r.purpose ? `, ${r.purpose}` : ""}`)
          .join("\n")
      : `- [none declared]`,
    ``,
    `Complaint to the Data Protection Board, include a concrete "Complaints to the Data Protection Board" section using this channel: ${DPB_COMPLAINT_CHANNEL.url} (${DPB_COMPLAINT_CHANNEL.text})`,
    ``,
    `Children's data (DPDP §9):`,
    `- Directed at or likely used by children (under 18): ${input.children.directedAtChildren ? "yes" : "no"}`,
    `- Child mode (age signal + verifiable parental consent before processing a child's data): ${input.children.childMode === "age_gate" ? "on" : "off"}`,
    `- Exemption relied on: ${input.children.exemptClass || "[none]"}`,
    `  In the children's-data section, reflect this exactly. If child mode is on or the service is used by children, state that an age signal and verifiable parental/guardian consent are obtained, and that non-essential tracking, behavioural monitoring, and targeted advertising are not used for children even with consent. Otherwise state the service is not directed at children.`,
  ].join("\n");
}
