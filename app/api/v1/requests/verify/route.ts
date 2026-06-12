import { redirect } from "next/navigation";
import { verifyRequest } from "@/lib/requests/store";

export const runtime = "nodejs";

/**
 * Confirm a rights request from the emailed link. Verifies the token, stamps the
 * due date, then sends the visitor to the preferences page with a status flag.
 * The redirect target uses the public site key, never an internal id.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const site = url.searchParams.get("site") ?? "";

  let ok = false;
  if (token) {
    try {
      const verified = await verifyRequest(token);
      ok = verified !== null;
    } catch (err) {
      console.error("[/v1/requests/verify] failed", err);
    }
  }

  const target = site ? `/p/${encodeURIComponent(site)}/preferences` : "/";
  redirect(`${target}?request=${ok ? "verified" : "invalid"}`);
}
