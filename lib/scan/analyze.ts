import { assertPublicUrl } from "@/lib/http/ssrf";
import { detectTrackers, detectActiveTrackers, type DetectedTracker } from "./trackers";

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
    /** Set when we followed the privacy link and read the notice text. */
    noticeUrl: string | null;
    noticeFetched: boolean;
    noticeRecipients: boolean;
    noticeCrossBorder: boolean;
    noticeDpbChannel: boolean;
    noticeRights: boolean;
    noticeChildren: boolean;
  };
  findings: Finding[];
}

const MAX_BYTES = 1024 * 1024; // read at most 1MB of HTML
const INDIAN_LANGS = ["hi", "ta", "te", "bn", "mr", "kn", "ml", "gu", "pa", "or", "as", "ur"];

// Common CMP / consent-banner signatures.
const BANNER_SIGNATURES =
  /cookieconsent|cookie-consent|onetrust|optanon|cookiebot|osano|termly|iubenda|quantcast|usercentrics|didomi|cookieyes|complianz|borlabs|trustarc|secureprivacy|skope\.js|data-site="sk_/i;

// Signals we look for INSIDE the privacy notice text (DPDP §5/§9/§11/§16 disclosures).
const NOTICE_SIGNATURES = {
  // §11(1)(b) — recipients / third parties the data is shared with.
  recipients:
    /third[\s-]?part(y|ies)|data processor|service provider|sub[\s-]?processor|with whom we (share|disclose)|share[sd]?\s+(your|the|personal)\s+(data|information)|recipients of/i,
  // §16 — cross-border transfer disclosure.
  crossBorder:
    /outside india|cross[\s-]?border|internationa(l|lly)[\s-]?(transfer|data)|transfer[^.<]{0,40}(outside|abroad|another country|other countr|overseas)|stored[^.<]{0,30}(outside|abroad|overseas)/i,
  // §5(1)(iii) — how to complain to the Data Protection Board.
  dpbChannel: /data protection board|\bdpb\b|board established under/i,
  // §11(1)(a) / §6 — a summary of the principal's rights.
  rights:
    /(your rights|rights as a data principal|you have the right)[^]{0,400}(access|correct|eras|grievance|nominat|withdraw)/i,
  // §9 — children's data section.
  children:
    /child(ren)?(['’]s)?\s+(data|personal|privacy|information)|under (the age of )?18|parental consent|guardian['’]?s? consent|verifiable parental/i,
};

const GRIEVANCE_RE = /(grievance officer|grievance redress|data protection officer|\bdpo\b)/i;
const INDIC_SCRIPT_RE = /[ऀ-෿]/; // Devanagari + other Indic Unicode blocks

/** Is the notice offered in an Eighth-Schedule Indian language (script or a lang switcher)? */
function hasIndianLanguage(html: string): boolean {
  if (INDIC_SCRIPT_RE.test(html)) return true;
  return new RegExp(`<option[^>]*value=["'](${INDIAN_LANGS.join("|")})["']`, "i").test(html);
}

/** Pull the most likely privacy-notice URL out of the homepage HTML. */
function findNoticeUrl(html: string, base: URL): URL | null {
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  let best: string | null = null;
  while ((m = re.exec(html))) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ");
    const looksLikePrivacy = /privacy/i.test(href) || /privacy\s*(policy|notice|statement)/i.test(text);
    if (!looksLikePrivacy) continue;
    // Prefer a dedicated /privacy(-notice) path over a generic match.
    if (/\/privacy([-_]?(notice|policy))?\/?($|\?)/i.test(href)) {
      best = href;
      break;
    }
    if (!best) best = href;
  }
  if (!best) return null;
  try {
    return new URL(best, base);
  } catch {
    return null;
  }
}

interface NoticeScan {
  url: string | null;
  fetched: boolean;
  /** The homepage links to a notice, but that link didn't yield a readable notice (e.g. 404). */
  linkBroken: boolean;
  recipients: boolean;
  crossBorder: boolean;
  dpbChannel: boolean;
  rights: boolean;
  children: boolean;
  /** Grievance officer / DPO named in the notice (commonly there, not on the homepage). */
  grievance: boolean;
  /** Notice is available in an Eighth-Schedule Indian language (e.g. a language switcher). */
  indianLanguage: boolean;
}

// Browser-shaped (but still honestly identified) UA — many sites serve a bare
// shell or 403 to obvious bots, which made the notice unreadable.
const NOTICE_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SkopeComplianceCheck/1.0 (+https://skope.network)";

const NOTICE_PATHS = ["/privacy-policy", "/privacy", "/privacy-notice", "/privacy-policy.html"];

/** Cheap guard so a soft-404 or homepage redirect isn't mistaken for the notice. */
function looksLikeNotice(html: string): boolean {
  return (
    /privacy/i.test(html) &&
    /(personal (data|information)|data protection|cookies?|consent|grievance|your rights)/i.test(html)
  );
}

function normKey(u: URL): string {
  return u.toString().replace(/[#?].*$/, "").replace(/\/+$/, "");
}

async function fetchNotice(candidate: URL): Promise<string | null> {
  let url: URL;
  try {
    url = await assertPublicUrl(candidate.toString());
  } catch {
    return null;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": NOTICE_UA },
    });
    if (!res.ok) return null;
    return (await res.text()).slice(0, MAX_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read the privacy notice so we can check WHAT'S IN IT, not just that it exists.
 * Tries the linked notice first, then conventional paths (SPA homepages often have
 * no crawlable link). Never throws — if nothing readable turns up, returns
 * `fetched:false` and the callers degrade to a single "couldn't read it" warning.
 */
async function scanNotice(homepageHtml: string, homepageUrl: URL, homepageText: string): Promise<NoticeScan> {
  const empty: NoticeScan = {
    url: null,
    fetched: false,
    linkBroken: false,
    recipients: false,
    crossBorder: false,
    dpbChannel: false,
    rights: false,
    children: false,
    grievance: false,
    indianLanguage: false,
  };

  const candidates: URL[] = [];
  const linked = findNoticeUrl(homepageHtml, homepageUrl);
  if (linked) candidates.push(linked);
  for (const p of NOTICE_PATHS) {
    try {
      candidates.push(new URL(p, homepageUrl));
    } catch {
      /* ignore */
    }
  }

  const homeKey = normKey(homepageUrl);
  const linkedKey = linked ? normKey(linked) : null;
  const seen = new Set<string>();
  let networkAttempts = 0;
  let linkBroken = false;

  for (const cand of candidates) {
    const key = normKey(cand);
    if (seen.has(key)) continue;
    seen.add(key);

    let html: string | null;
    if (key === homeKey) {
      html = homepageText; // notice lives on the homepage we already fetched
    } else {
      if (networkAttempts >= 3) continue; // bound the work
      networkAttempts++;
      html = await fetchNotice(cand);
    }
    if (!html || !looksLikeNotice(html)) {
      // The site's own privacy link led nowhere readable (404, shell, redirect).
      if (key === linkedKey) linkBroken = true;
      continue;
    }

    return {
      url: cand.toString(),
      fetched: true,
      linkBroken: false,
      recipients: NOTICE_SIGNATURES.recipients.test(html),
      crossBorder: NOTICE_SIGNATURES.crossBorder.test(html),
      dpbChannel: NOTICE_SIGNATURES.dpbChannel.test(html),
      rights: NOTICE_SIGNATURES.rights.test(html),
      children: NOTICE_SIGNATURES.children.test(html),
      grievance: GRIEVANCE_RE.test(html),
      indianLanguage: hasIndianLanguage(html),
    };
  }

  return { ...empty, url: linked?.toString() ?? null, linkBroken };
}

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

  // All known trackers referenced (for listing) vs. those that actually execute on
  // load — preloaded or CMP-gated trackers don't run before consent, so we grade the
  // active set and only inform about the rest.
  const trackers = detectTrackers(html);
  const activeTrackers = detectActiveTrackers(html);
  const langAttr = html.match(/<html[^>]*\blang=["']([a-z-]+)["']/i)?.[1]?.toLowerCase() ?? null;
  const homepageIndianLanguage =
    INDIC_SCRIPT_RE.test(html) || (langAttr ? INDIAN_LANGS.some((l) => langAttr.startsWith(l)) : false);

  const consentBannerDetected =
    BANNER_SIGNATURES.test(html) ||
    (/cookie/i.test(html) && /(consent|accept all|manage cookies|cookie preferences)/i.test(html));
  const privacyPolicyFound = /(privacy[\s-]?policy|\/privacy|privacy[_-]?notice)/i.test(html);

  // Follow the privacy link and read the notice so we can check its DPDP disclosures.
  const notice = privacyPolicyFound
    ? await scanNotice(html, url, html)
    : { url: null, fetched: false, linkBroken: false, recipients: false, crossBorder: false, dpbChannel: false, rights: false, children: false, grievance: false, indianLanguage: false };

  // Grievance contact and language support commonly live in the notice, not the
  // homepage — credit either place.
  const grievanceContactFound = GRIEVANCE_RE.test(html) || notice.grievance;
  const indianLanguageSupport = homepageIndianLanguage || notice.indianLanguage;

  // --- scoring rubric (documented; total 100) ---
  // Homepage checks (85) + notice-content checks (15, 3 each). Notice points only
  // accrue when we could actually open and read the notice.
  let score = 0;
  if (consentBannerDetected) score += 30;
  if (privacyPolicyFound) score += 15;
  if (grievanceContactFound) score += 15;
  if (activeTrackers.length === 0) score += 15;
  else if (consentBannerDetected) score += 8;
  if (indianLanguageSupport) score += 10;
  if (notice.fetched) {
    if (notice.recipients) score += 3;
    if (notice.crossBorder) score += 3;
    if (notice.dpbChannel) score += 3;
    if (notice.rights) score += 3;
    if (notice.children) score += 3;
  }
  score = Math.max(0, Math.min(100, score));

  const band = score >= 80 ? "on_track" : score >= 50 ? "needs_work" : "at_risk";

  // Notice-content checks. When we could actually read the notice, show one row per
  // disclosure (pass/fail). When we couldn't, collapse to a single honest warning
  // rather than five identical yellow rows that look broken.
  const noticeFindings: Finding[] = notice.fetched
    ? [
        {
          id: "notice_recipients",
          title: "Who you share data with",
          status: notice.recipients ? "pass" : "fail",
          detail: notice.recipients
            ? "Your notice names the third parties / processors you share data with."
            : "Your notice doesn't list who you share data with. DPDP (§11) lets a person ask for every recipient of their data.",
        },
        {
          id: "notice_cross_border",
          title: "Cross-border transfers",
          status: notice.crossBorder ? "pass" : "fail",
          detail: notice.crossBorder
            ? "Your notice discloses transfers of data outside India."
            : "If you send data outside India, DPDP (§16) expects your notice to say so. We didn't find a transfer disclosure.",
        },
        {
          id: "notice_dpb",
          title: "Complain to the Data Protection Board",
          status: notice.dpbChannel ? "pass" : "fail",
          detail: notice.dpbChannel
            ? "Your notice tells people how to complain to the Data Protection Board."
            : "DPDP (§5(1)(iii)) requires your notice to explain how to complain to the Data Protection Board. We didn't find it.",
        },
        {
          id: "notice_rights",
          title: "Data principal rights",
          status: notice.rights ? "pass" : "fail",
          detail: notice.rights
            ? "Your notice summarises the rights people can exercise (access, correction, erasure, grievance)."
            : "DPDP (§11–§14) gives people rights to access, correct, erase and complain. We didn't find these set out in your notice.",
        },
        {
          id: "notice_children",
          title: "Children's data",
          status: notice.children ? "pass" : "fail",
          detail: notice.children
            ? "Your notice addresses children's data and parental consent."
            : "If children may use your service, DPDP (§9) needs verifiable parental consent and a children's-data section. We didn't find one.",
        },
      ]
    : [
        {
          id: "notice_contents",
          title: "Privacy notice contents",
          status: "warn",
          detail: notice.linkBroken
            ? "Your privacy link looks broken — it doesn't load a readable notice (e.g. it returns a 404). Visitors can't read your notice, so we couldn't check it. Point the link at your live notice URL and re-scan."
            : privacyPolicyFound
              ? "We found a privacy notice but couldn't open it to check it covers sharing, cross-border transfers, data-principal rights, children's data, and how to complain to the Data Protection Board."
              : "Add a privacy notice first — then we can check it covers sharing, cross-border transfers, rights, children's data, and the Data Protection Board.",
        },
      ];

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
      status: activeTrackers.length === 0 ? "pass" : consentBannerDetected ? "warn" : "fail",
      detail:
        activeTrackers.length === 0
          ? trackers.length === 0
            ? "No known third-party trackers found on the homepage."
            : `We found ${trackers.length} tracker${trackers.length > 1 ? "s" : ""} (${trackers.map((t) => t.name).join(", ")}), but ${trackers.length > 1 ? "they're" : "it's"} preloaded or gated until consent — nothing runs before the visitor opts in.`
          : `${activeTrackers.length} tracker${activeTrackers.length > 1 ? "s" : ""} load on page open (${activeTrackers.map((t) => t.name).join(", ")}). ${
              consentBannerDetected
                ? "These aren't gated — confirm they wait for consent (Skope gates a script with type=\"text/plain\" data-skope)."
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
        ? notice.grievance && !GRIEVANCE_RE.test(html)
          ? "Grievance / DPO contact details are in your privacy notice."
          : "Grievance / DPO contact details were found."
        : "No grievance officer contact found on your homepage or in your notice. DPDP requires you to publish a grievance redressal contact.",
    },
    {
      id: "language",
      title: "Language",
      status: indianLanguageSupport ? "pass" : "warn",
      detail: indianLanguageSupport
        ? notice.indianLanguage && !homepageIndianLanguage
          ? "Your privacy notice is available in an Indian language."
          : "Your site appears to support an Indian language."
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
    ...noticeFindings,
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
      noticeUrl: notice.url,
      noticeFetched: notice.fetched,
      noticeRecipients: notice.recipients,
      noticeCrossBorder: notice.crossBorder,
      noticeDpbChannel: notice.dpbChannel,
      noticeRights: notice.rights,
      noticeChildren: notice.children,
    },
    findings,
  };
}
