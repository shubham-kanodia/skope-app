/**
 * The assistant's product knowledge: what Skope does and how to use it, fed
 * into every assistant request so answers reference real screens and real
 * behaviour instead of guesses.
 *
 * KEEP THIS CURRENT. When you change user-facing behaviour (a wizard step, a
 * page, a plan limit, an offer, an endpoint the customer touches), update the
 * matching section here in the same change. The assistant repeats this file to
 * customers; stale text here is a support bug. Dated facts (offers, prices)
 * carry their dates so drift is visible.
 */
export const PRODUCT_CONTEXT = `SKOPE PRODUCT GUIDE (for answering "how do I…" questions; navigation paths are real)

What Skope is: a DPDP consent management platform for Indian websites. One script tag adds a consent banner, blocks trackers until consent, records tamper-evident consent receipts, hosts the privacy notice and a preference centre, and manages data-principal rights requests.

DASHBOARD PAGES (left sidebar): Sites (home, one card per site with setup progress), Records (consent receipts), Requests (rights-request queue), Assistant (this chat), Team (on plans with more than one seat), Billing.

SITE SETUP WIZARD — open a site from Sites; five steps, in order:
1. "Install Skope": copy the snippet <script src="…/skope.js" data-site="sk_live_…" defer></script> into the site's <head>. To block a tracker until consent, change its script tag to type="text/plain" with data-skope and data-skope-purpose="analytics" (or "marketing"); Skope releases it when that purpose is granted. Google Consent Mode v2 defaults to denied automatically. The step completes itself when Skope sees the tag load on any real page — this works on localhost too: just open a local page carrying the tag in a browser. If no load was ever seen, the "check" fetches the registered domain and looks for the tag, so an undeployed site will report "tag not found" until a page actually loads it. The script also exposes window.skope.getConsent() and window.skope.openPreferences().
2. "Customize your banner": layout (bottom bar, centre modal, corner card), accent colour, heading/description/button copy, languages. The first language is the default; the rest are auto-translated on save and reviewable in the preview. All 22 Eighth Schedule languages plus English are available on every plan. Optional language switcher and a persistent "privacy choices" button for easy withdrawal.
3. "Declare the data you collect" (DPDP §5 — the notice must itemize personal data, not just cookies): add each item (name, email, PAN…) with a category, the purpose it serves, where it's collected, and an optional retention period. Quick-add presets cover common items; or upload a screenshot of any form and Skope suggests the fields it sees (the image is read once and discarded, never stored). Declared items appear in the privacy notice and under each purpose in the banner's manage view.
4. "Add your contact": legal entity name, grievance officer (name + email required — DPDP requires a working grievance contact), optional DPO, and the response window in days (default 30) which sets the due-date clock on rights requests.
5. "Publish your privacy notice": generate a draft from the site's real settings (purposes, trackers found, declared data items, contacts), edit it, publish. Published versions are immutable and checksummed; publishing a new version makes returning visitors re-consent. The public notice lives at /p/<siteKey>/privacy in every enabled language.

PURPOSES: a fixed set today — "Strictly necessary" (always on, no consent needed), "Analytics", and "Marketing". Visitors choose per purpose in the banner's manage view.

PREFERENCE CENTRE (hosted, no code): /p/<siteKey>/preferences. Visitors verify by email OTP, then view and change consent, withdraw (one tap, as easy as granting — that's the law), or file a rights request.

RIGHTS REQUESTS (Requests page): five types — access, correction, erasure, nomination, grievance. Flow: visitor submits on the preference centre → confirms by email → lands in the queue as "new" with a due date from the site's response window → the team works it (in progress) → closes it (done/rejected) with a resolution note. Overdue requests are flagged. Requester contact details are stored encrypted.

RECORDS & PROOF (Records page): every consent decision is a receipt in a per-site hash chain (each row cryptographically linked to the previous; the database refuses edits). The page shows recent receipts; "Download CSV" exports the full history on any plan. "Download audit bundle" (Growth-level access) produces the regulator-ready ZIP: receipts per site, every published notice version, a fresh chain-verification report, requests CSV, SHA-256 manifest, and a PDF cover sheet. Anyone can independently anchor a site's chain head at /api/v1/ledger-head/<siteKey>.

GEO MODES (per site): "India only" (default — banner shows only to visitors in India), "Global", or a custom country list.

TEAM (Team page): roles are owner, admin, viewer (viewers can't change anything). Invites are available on plans with more than one seat (Growth: 3 seats, Scale: 10).

BILLING & THE LAUNCH OFFER (Billing page) — dated facts, verify against today's date:
- Launch offer: every org that signs up before 12 July 2026 gets 6 months of Growth-level access free, no card. Payments are paused for everyone until 12 August 2026 — nothing can be purchased and nothing is owed before then.
- Plans (what pricing looks like after that): Free ₹0 (5,000 consents/mo, 1 site), Starter ₹999/mo (25,000, 3 sites), Growth ₹2,999/mo (100,000, 10 sites, 3 seats, audit bundle), Scale ₹7,999/mo (500,000, unlimited sites, 10 seats, no Skope branding). All plans include all languages. Trials get Growth-level limits for 30 days.
- Referrals: share the link on the Billing page; both sides get bonus free days.
- If a trial lapses or a limit is exceeded, the visitor-facing banner KEEPS WORKING — only dashboard editing pauses.

SECURITY & RESIDENCY (what you can truthfully tell customers): data is stored in Mumbai (ap-south-1). End-user personal data (requester contacts and details) is encrypted with AES-256-GCM under a per-organisation key; deleting the org destroys the key, making the data unrecoverable even in backups. Receipts contain no raw PII: IPs are truncated, user agents are hashed.

WHAT SKOPE DOES NOT DO (don't invent features): no cookie-wall/paywall mode, no per-site custom purposes yet (the three fixed purposes), no DSAR identity-document verification, no on-premise hosting, no Android/iOS SDKs. If asked for one of these, say it isn't available today rather than improvising.`;
