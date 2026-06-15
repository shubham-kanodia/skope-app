/**
 * The structured shape of a privacy notice. Stored per-language in
 * notices.content_i18n as { en: PolicyContent, hi: PolicyContent, ... }.
 * The generator (OpenRouter, or the deterministic template fallback) produces
 * the English source; translations are derived from it.
 */
export interface PolicySection {
  heading: string;
  body: string; // plain text, paragraphs separated by blank lines
}

export interface PolicyContent {
  title: string;
  intro: string;
  sections: PolicySection[];
}

/** Everything the generator needs about a site to draft its notice. */
export interface PolicyInput {
  orgName: string;
  domain: string;
  purposes: {
    key: string;
    isEssential: boolean;
    name: string;
    description: string;
    retentionDays?: number | null;
  }[];
  trackers: { name: string; category: string }[];
  /** Declared personal data items (DPDP §5: the notice must itemize them). */
  dataItems: {
    name: string;
    category: string;
    purpose: string;
    source?: string | null;
    retentionDays?: number | null;
  }[];
  grievanceName: string;
  grievanceEmail: string;
  grievancePhone: string;
  grievanceAddress: string;
  dpoName: string;
  dpoEmail: string;
  responseDays: number;
  /** Children's-data configuration (DPDP §9), so the notice reflects reality. */
  children: {
    directedAtChildren: boolean;
    childMode: "off" | "age_gate";
    exemptClass: string | null;
  };
  /** Declared recipients (DPDP §11(1)(b)) and their destination countries (§16). */
  recipients: {
    name: string;
    role: "fiduciary" | "processor";
    purpose: string | null;
    country: string | null;
  }[];
}

/** Coerce untrusted JSON (from the model) into a valid PolicyContent. */
export function coercePolicyContent(raw: unknown): PolicyContent | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.slice(0, 160) : "Privacy notice";
  const intro = typeof r.intro === "string" ? r.intro.slice(0, 2000) : "";
  if (!Array.isArray(r.sections)) return null;
  const sections: PolicySection[] = [];
  for (const s of r.sections) {
    if (!s || typeof s !== "object") continue;
    const sec = s as Record<string, unknown>;
    const heading = typeof sec.heading === "string" ? sec.heading.slice(0, 160) : "";
    const body = typeof sec.body === "string" ? sec.body.slice(0, 6000) : "";
    if (heading && body) sections.push({ heading, body });
  }
  if (sections.length === 0) return null;
  return { title, intro, sections };
}
