"use server";

import { verifyAndGrant } from "@/lib/parental/store";

export interface ConfirmResult {
  ok?: boolean;
  alreadyVerified?: boolean;
  error?: string;
}

/**
 * Confirm parental consent from the guardian's emailed link. Runs on an explicit
 * button press (not on page load) so email link-scanners can't auto-confirm.
 */
export async function confirmParentalConsent(token: string): Promise<ConfirmResult> {
  if (!token || token.length < 16) return { error: "This link looks invalid." };
  try {
    const res = await verifyAndGrant(token);
    if (!res.ok) return { error: "This link is invalid or has expired." };
    return { ok: true, alreadyVerified: res.alreadyVerified };
  } catch (err) {
    console.error("[parental] confirm failed", err);
    return { error: "Couldn't confirm right now. Try again in a minute." };
  }
}
