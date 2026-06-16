/**
 * Known third-party tracker registry. Used by the compliance checker to detect
 * trackers in a page's HTML. Kept in sync (by intent) with skope.js's blocking
 * list. category drives the DPDP purpose a tracker maps to.
 */
export interface TrackerDef {
  name: string;
  category: "analytics" | "marketing";
  re: RegExp;
}

export const TRACKERS: TrackerDef[] = [
  { name: "Google Analytics / GA4", category: "analytics", re: /google-analytics\.com|\/gtag\/js|googletagmanager\.com\/gtag/i },
  { name: "Google Tag Manager", category: "analytics", re: /googletagmanager\.com\/gtm\.js|googletagmanager\.com\/ns\.html/i },
  { name: "Meta Pixel", category: "marketing", re: /connect\.facebook\.net|facebook\.com\/tr/i },
  { name: "Microsoft Clarity", category: "analytics", re: /clarity\.ms/i },
  { name: "Hotjar", category: "analytics", re: /static\.hotjar\.com|script\.hotjar\.com/i },
  { name: "LinkedIn Insight", category: "marketing", re: /snap\.licdn\.com|ads\.linkedin\.com/i },
  { name: "Google Ads / DoubleClick", category: "marketing", re: /doubleclick\.net|googlesyndication\.com|googleadservices\.com/i },
  { name: "TikTok Pixel", category: "marketing", re: /analytics\.tiktok\.com/i },
  { name: "X / Twitter Pixel", category: "marketing", re: /static\.ads-twitter\.com|t\.co\/i\/adsct/i },
  { name: "Pinterest Tag", category: "marketing", re: /s\.pinimg\.com\/ct/i },
  { name: "Segment", category: "analytics", re: /cdn\.segment\.com/i },
  { name: "Mixpanel", category: "analytics", re: /cdn\.mxpnl\.com|api\.mixpanel\.com/i },
  { name: "Amplitude", category: "analytics", re: /cdn\.amplitude\.com|api\.amplitude\.com/i },
  { name: "FullStory", category: "analytics", re: /fullstory\.com\/s\/fs\.js/i },
  { name: "Intercom", category: "marketing", re: /widget\.intercom\.io|js\.intercomcdn\.com/i },
];

export interface DetectedTracker {
  name: string;
  category: "analytics" | "marketing";
}

/** Return the de-duplicated set of known trackers referenced anywhere in the HTML. */
export function detectTrackers(html: string): DetectedTracker[] {
  const found = new Map<string, DetectedTracker>();
  for (const t of TRACKERS) {
    if (t.re.test(html)) found.set(t.name, { name: t.name, category: t.category });
  }
  return [...found.values()];
}

/**
 * Trackers that would actually execute on load, ignoring references that don't run
 * before consent: resource hints (`<link rel="preload/prefetch/preconnect">`) only
 * fetch bytes, and CMP-gated scripts (`type="text/plain"` + `data-skope`, the Skope
 * blocking technique) don't run until the visitor opts in. A page can preload GA and
 * still be compliant if the script is gated — so this is what the scan should grade.
 */
export function detectActiveTrackers(html: string): DetectedTracker[] {
  const executable = html
    // Resource hints fetch but never execute.
    .replace(/<link\b[^>]*\brel=["']?(?:preload|modulepreload|prefetch|preconnect|dns-prefetch)["']?[^>]*>/gi, " ")
    // Scripts gated by a CMP (Skope and most others mark them text/plain + a data-* flag).
    .replace(/<script\b[^>]*\bdata-skope\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<script\b[^>]*\btype=["']text\/plain["'][^>]*>[\s\S]*?<\/script>/gi, " ");
  return detectTrackers(executable);
}
