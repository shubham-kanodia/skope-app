"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth/guard";
import { updateRequestStatus, type RequestStatus } from "@/lib/requests/store";
import { sendEmail } from "@/lib/email/send";

const STATUSES = new Set<RequestStatus>(["new", "in_progress", "done", "rejected"]);

export interface UpdateRequestResult {
  ok?: boolean;
  error?: string;
}

/** Move a request through its workflow and notify the requester when it closes. */
export async function updateRequest(
  requestId: string,
  status: RequestStatus,
  note: string,
): Promise<UpdateRequestResult> {
  const session = await requireSession();
  if (!STATUSES.has(status)) return { error: "Invalid status." };

  const result = await updateRequestStatus(session.orgId, requestId, status, note.trim() || null);
  if (!result) return { error: "Request not found." };

  // Tell the requester when their request is resolved or declined.
  if ((status === "done" || status === "rejected") && result.email) {
    const outcome = status === "done" ? "completed" : "declined";
    try {
      await sendEmail({
        to: result.email,
        subject: `Your privacy request was ${outcome}`,
        text: `Your ${result.type} request for ${result.domain} was ${outcome}.${note.trim() ? `\n\nNote: ${note.trim()}` : ""}`,
        html: `<p>Your ${result.type} request for ${result.domain} was ${outcome}.</p>${
          note.trim() ? `<p style="color:#5b616e">Note: ${escapeHtml(note.trim())}</p>` : ""
        }`,
      });
    } catch (err) {
      console.error("[requests] completion email failed", err);
    }
  }

  revalidatePath("/dashboard/requests");
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);
}
