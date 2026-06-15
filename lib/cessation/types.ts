/**
 * Pure types + labels for processor-cease tasks, no DB import, so the erasure
 * queue client UI can use them without bundling the Postgres client. The store
 * re-exports these.
 */
export type CessationStatus = "pending" | "signalled" | "acknowledged" | "manual_done";

export const CESSATION_STATUS_LABELS: Record<CessationStatus, string> = {
  pending: "Pending",
  signalled: "Signalled",
  acknowledged: "Acknowledged",
  manual_done: "Done (manual)",
};

export interface CessationTask {
  id: string;
  obligationId: string;
  recipientId: string;
  recipientName: string;
  hasWebhook: boolean;
  status: CessationStatus;
  signalledAt: string | null;
  ackAt: string | null;
  note: string | null;
}
