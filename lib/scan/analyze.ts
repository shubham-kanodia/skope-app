import { assertPublicUrl } from "@/lib/http/ssrf";
import { detectTrackers, type DetectedTracker } from "./trackers";

export type FindingStatus = "pass" | "warn" | "fail";

export interface Finding {
  id: string;
  title: string;
  status: FindingStatus;
  detail: string;
}

export interface ComplianceReport {
  domain: string;
  scannedUrl: string;
  scannedAt: string;
  score: number; // 0-100
  band: "on_track" | "needs_work" | "at_risk";
  trackers: DetectedTracker[];
  signals: {
    consentBannerDetected: boolean;
    privacyPolicyFound: boolean;
    grievanceContactFound: boolean;
    indianLanguageSupport: boolean;
    cookiesSetOnLoad: number;
    langAttr: string | null;
  };
  findings: Finding[];
}

const MAX_BYTES = 1024 * 1024; // read at most 1MB of HTML
const INDIAN_LANGS = ["hi", "ta", "te", "bn", "mr", "kn", "ml", "gu", "pa", "or", "as", "ur"];

// Common CMP / consent-banner signatures.
const BANNER_SIGNATURES =
  /cookieconsent|cookie-consent|onetrust|optanon|cookiebot|osano|termly|iubenda|quantcast|usercentrics|didomi|cookieyes|complianz|borlabs|trustarc|secureprivacy|skope\.js|data-site="sk_/i;

export async function analyzeSite(domainOrUrl: string): Promise<ComplianceReport> {
  const target = /^https?:\/\//i.test(domainOrUrl) ? domainOrUrl : `https://${domainOrUrl}`;
  const url = await assertPublicUrl(target);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  const res = await fetch(url, {
    signal: controller.signal,
    redirect: "follow",
    headers: { "User-Agent": "SkopeComplianceCheck/1.0 (+https://skope.network)" },
  }).finally(() => clearTimeout(timer));

  if (!res.ok) {
    throw new Error(`Your site returned ${res.status}. Check the URL and that it's live.`);
  }

  const html = (await res.text()).slice(0, MAX_BYTES);
  const cookiesSetOnLoad = res.headers.getSetCookie?.().length ?? 0;

  const trackers = detectTrackers(html);
  const langAttr = html.match(/<html[^>]*\blang=["']([a-z-]+)["']/i)?.[1]?.toLowerCase() ?? null;
  const hasIndicScript = /[ऀ-෿]/.test(html); // Devanagari + other Indic blocks
  const indianLanguageSupport =
    hasIndicScript || (langAttr ? INDIAN_LANGS.some((l) => langAttr.startsWith(l)) : false);

  const consentBannerDetected =
    BANNER_SIGNATURES.test(html) ||
    (/cookie/i.test(html) && /(consent|accept all|manage cookies|cookie preferences)/i.test(html));
  const privacyPolicyFound = /(privacy[\s-]?policy|\/privacy|privacy[_-]?notice)/i.test(html);
  const grievanceContactFound =
    /(grievance officer|grievance redress|data protection officer|\bdpo\b)/i.test(html);

  // --- scoring rubric (documented; total 100) ---
  let score = 0;
  if (consentBannerDetected) score += 30;
  if (privacyPolicyFound) score += 20;
  if (grievanceContactFound) score += 15;
  if (trackers.length === 0) score += 20;
  else if (consentBannerDetected) score += 10;
  if (indianLanguageSupport) score += 15;
  score = Math.max(0, Math.min(100, score));

  const band = score >= 80 ? "on_track" : score >= 50 ? "needs_work" : "at_risk";

  const findings: Finding[] = [
    {
      id: "consent_banner",
      title: "Consent banner",
      status: consentBannerDetected ? "pass" : "fail",
      detail: consentBannerDetected
        ? "We detected a consent mechanism on your homepage."
        : "We didn't find a consent banner. DPDP requires free, informed consent before you process non-essential personal data.",
    },
    {
      id: "trackers",
      title: "Trackers",
      status: trackers.length === 0 ? "pass" : consentBannerDetected ? "warn" : "fail",
      detail:
        trackers.length === 0
          ? "No known third-party trackers found on the homepage."
          : `${trackers.length} tracker${trackers.length > 1 ? "s" : ""} found (${trackers.map((t) => t.name).join(", ")}). ${
              consentBannerDetected
                ? "Confirm they stay blocked until the visitor consents."
                : "These appear to load before any consent, which DPDP doesn't allow."
            }`,
    },
    {
      id: "privacy_notice",
      title: "Privacy notice",
      status: privacyPolicyFound ? "pass" : "warn",
      detail: privacyPolicyFound
        ? "A privacy policy / notice link is present."
        : "We couldn't find a privacy notice link. DPDP requires a clear, itemised notice of what you collect and why.",
    },
    {
      id: "grievance",
      title: "Grievance contact",
      status: grievanceContactFound ? "pass" : "warn",
      detail: grievanceContactFound
        ? "Grievance / DPO contact details were found."
        : "No grievance officer contact found. DPDP requires you to publish a grievance redressal contact.",
    },
    {
      id: "language",
      title: "Language",
      status: indianLanguageSupport ? "pass" : "warn",
      detail: indianLanguageSupport
        ? "Your site appears to support an Indian language."
        : "We only detected English. DPDP lets data principals ask for the notice in any Eighth-Schedule language.",
    },
    {
      id: "cookies",
      title: "Cookies on load",
      status: cookiesSetOnLoad === 0 ? "pass" : consentBannerDetected ? "warn" : "fail",
      detail:
        cookiesSetOnLoad === 0
          ? "No cookies were set before any interaction."
          : `${cookiesSetOnLoad} cookie${cookiesSetOnLoad > 1 ? "s were" : " was"} set on load${
              consentBannerDetected ? ", verify non-essential cookies wait for consent." : ", before any consent."
            }`,
    },
  ];

  return {
    domain: url.hostname.replace(/^www\./, ""),
    scannedUrl: url.toString(),
    scannedAt: new Date().toISOString(),
    score,
    band,
    trackers,
    signals: {
      consentBannerDetected,
      privacyPolicyFound,
      grievanceContactFound,
      indianLanguageSupport,
      cookiesSetOnLoad,
      langAttr,
    },
    findings,
  };
}
