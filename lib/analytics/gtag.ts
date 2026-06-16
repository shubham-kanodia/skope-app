/**
 * Typed GA4 event tracking. Client-side only, every event Skope sends is
 * declared in AnalyticsEvents so names and params stay consistent across call
 * sites and in GA custom definitions.
 *
 * Cost params are uniformly named so one GA custom metric aggregates spend:
 * - translate_chars / translate_languages → Google Translate (chars billed =
 *   source chars × target languages actually sent)
 * - data_extract_* event counts → one OpenRouter vision call each
 */

export interface AnalyticsEvents {
  login_link_requested: { has_ref: boolean; is_invite: boolean };
  sign_up: { method: "magic_link" };
  login: { method: "magic_link" };
  site_created: Record<string, never>;
  setup_step_completed: { step: string; site_id: string };
  setup_completed: { site_id: string };
  install_verified: { source: string; domain_match: boolean };
  banner_saved: {
    layout: string;
    languages_count: number;
    translate_chars: number;
    translate_languages: number;
  };
  banner_preview_translated: { translate_chars: number; translate_languages: number };
  policy_generated: {
    source: "ai" | "template";
    translate_chars: number;
    translate_languages: number;
  };
  policy_draft_saved: { translate_chars: number; translate_languages: number };
  policy_published: { version: number };
  begin_checkout: { currency: "INR"; value: number; plan: string };
  plan_granted: { plan: string };
  data_extract_completed: { items_count: number; file_kb: number };
  data_extract_failed: { status: number; file_kb: number };
  // Public compliance checker funnel (lead-gen): a scan, then the emailed report.
  compliance_scan: { score: number; band: string; tracker_count: number };
  compliance_report_emailed: { score: number; band: string };
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/** Fire a GA4 event. No-ops on the server, when GA is off, or before gtag loads. */
export function track<E extends keyof AnalyticsEvents>(
  event: E,
  params: AnalyticsEvents[E],
): void {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_GA_ID || typeof window.gtag !== "function") return;
  window.gtag("event", event, params);
}
