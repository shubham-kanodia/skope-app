/**
 * Pure types + labels for erasure obligations, no DB import, so client
 * components (the erasure queue UI) can use the labels without dragging the
 * Postgres client into the browser bundle. The store re-exports these.
 */
export type ErasureKind = "withdrawal" | "retention_lapsed" | "request" | "inactivity";
export type ErasureStatus = "open" | "in_progress" | "done" | "not_required";

export const ERASURE_KIND_LABELS: Record<ErasureKind, string> = {
  withdrawal: "Consent withdrawn",
  retention_lapsed: "Retention period lapsed",
  request: "Erasure request",
  inactivity: "Inactive, purpose no longer served",
};

export const ERASURE_STATUS_LABELS: Record<ErasureStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  done: "Erased",
  not_required: "Not required",
};

export interface ErasureRow {
  id: string;
  siteId: string;
  domain: string;
  subjectId: string | null;
  requestId: string | null;
  kind: ErasureKind;
  sourceAction: string | null;
  basis: string | null;
  dueAt: string;
  status: ErasureStatus;
  resolvedAt: string | null;
  resolutionNote: string | null;
  createdAt: string;
}
