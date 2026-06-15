import { createHash } from "node:crypto";
import { getSession } from "@/lib/auth/session";
import { getOrgGate } from "@/lib/billing/gate";
import { listSites, getSiteForOrg } from "@/lib/orgs/queries";
import { exemptionsFromSettings } from "@/lib/exemptions/settings";
import { listReceiptsForExport, type ExportCursor } from "@/lib/consent/list";
import { listRequestsForExport } from "@/lib/requests/store";
import { listIncidents, listNotifications } from "@/lib/breach/store";
import { listObligations } from "@/lib/erasure/store";
import { listParentalConsentsForOrg } from "@/lib/parental/store";
import { listRecipientsForOrg } from "@/lib/recipients/store";
import { listCessationForOrg } from "@/lib/cessation/store";
import { getSdfSettings, listDpia, listAuditors, getAuditSchedule } from "@/lib/sdf/store";
import { listDeliveryForOrg } from "@/lib/retro/store";
import { listNominationsForExport } from "@/lib/nominations/store";
import { listPublishedNotices } from "@/lib/notices/store";
import { verifySiteChain, ledgerHead } from "@/lib/consent/verify";
import { toCsvRow } from "@/lib/export/csv";
import { ZipBuilder } from "@/lib/export/zip";
import { buildSimplePdf, type PdfLine } from "@/lib/export/pdf";
import { renderNoticeHtml } from "@/lib/export/notice-html";
import { writeAudit } from "@/lib/audit/write";

export const runtime = "nodejs";

// Stored-entry zips buffer each file, so bound the bundle; full history is
// always available through the streaming CSV export. Stated on the cover sheet.
const MAX_RECEIPTS_PER_SITE = 250_000;

const RECEIPT_HEADER = [
  "occurred_at", "domain", "seq", "action", "method", "purposes_granted",
  "purposes_denied", "notice_version", "notice_checksum", "language", "region", "row_hash",
];

/**
 * The regulator-ready audit bundle (plan-gated, growth+): per-site receipts
 * CSV, every published notice version (JSON + standalone HTML), a re-run
 * hash-chain verification report, requests CSV, a manifest with SHA-256 of
 * each entry, and a PDF cover sheet.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Sign in to do this." }, { status: 401 });
  }

  const gate = await getOrgGate(session.orgId);
  if (!gate) return Response.json({ error: "Organisation not found." }, { status: 404 });
  if (!gate.limits.auditExport) {
    return Response.json(
      { error: "Audit bundles are on the Growth plan. Your consent data is always yours, CSV export stays available." },
      { status: 403 },
    );
  }

  const wantedSite = new URL(request.url).searchParams.get("site");
  let sites = await listSites(session.orgId);
  if (wantedSite && wantedSite !== "all") sites = sites.filter((s) => s.id === wantedSite);
  if (sites.length === 0) return Response.json({ error: "Site not found." }, { status: 404 });

  await writeAudit({ orgId: session.orgId, actorUserId: session.userId, action: "export.bundle", target: wantedSite ?? "all" });

  const zip = new ZipBuilder();
  const manifest: Record<string, string> = {};
  const addEntry = (name: string, data: Uint8Array | string) => {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    zip.add(name, bytes);
    manifest[name] = createHash("sha256").update(bytes).digest("hex");
  };

  const generatedAt = new Date();
  const ist = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Kolkata" });

  // Per-site: receipts CSV, notice versions, chain verification.
  const siteReports: {
    siteId: string;
    domain: string;
    count: number;
    truncated: boolean;
    ok: boolean;
    brokenAt: number | null;
    reason?: string;
    headSeq: number;
    headHash: string | null;
    verifyUrl: string;
  }[] = [];
  const appBase = process.env.NEXT_PUBLIC_APP_URL ?? "";

  for (const site of sites) {
    let csv = toCsvRow(RECEIPT_HEADER);
    let cursor: ExportCursor | null = null;
    let count = 0;
    let truncated = false;
    for (;;) {
      const rows = await listReceiptsForExport(session.orgId, { siteId: site.id, after: cursor });
      if (rows.length === 0) break;
      for (const r of rows) {
        csv += toCsvRow([
          new Date(r.occurred_at).toISOString(), r.domain, r.seq, r.action, r.method,
          (r.purposes_granted ?? []).join(" "), (r.purposes_denied ?? []).join(" "),
          r.notice_version ?? "", r.notice_checksum ?? "", r.language_shown ?? "", r.region ?? "", r.row_hash_hex,
        ]);
      }
      count += rows.length;
      if (count >= MAX_RECEIPTS_PER_SITE) {
        truncated = true;
        break;
      }
      const last = rows[rows.length - 1];
      cursor = { occurredAt: last.occurred_at, id: last.id };
    }
    addEntry(`receipts-${site.domain}.csv`, csv);

    for (const notice of await listPublishedNotices(site.id)) {
      const base = `notices/${site.domain}/v${notice.version}`;
      addEntry(`${base}.json`, JSON.stringify(notice, null, 2));
      const en = notice.contentI18n.en ?? Object.values(notice.contentI18n)[0];
      if (en) {
        addEntry(
          `${base}.html`,
          renderNoticeHtml(en, {
            domain: site.domain,
            version: notice.version,
            publishedAt: notice.publishedAt ? new Date(notice.publishedAt).toISOString() : null,
            checksum: notice.checksum,
          }),
        );
      }
    }

    const chain = await verifySiteChain(site.id);
    const head = await ledgerHead(site.id);
    siteReports.push({
      siteId: site.id,
      domain: site.domain,
      count,
      truncated,
      ok: chain.ok,
      brokenAt: chain.brokenAt,
      reason: chain.reason,
      headSeq: head.seq,
      headHash: head.headHash,
      verifyUrl: `${appBase}/api/v1/ledger-head/${site.site_key}`,
    });
  }

  addEntry(
    "chain-verification.json",
    JSON.stringify({ generatedAt: generatedAt.toISOString(), sites: siteReports }, null, 2),
  );

  const requests = await listRequestsForExport(
    session.orgId,
    wantedSite && wantedSite !== "all" ? wantedSite : undefined,
  );
  let reqCsv = toCsvRow(["created_at", "domain", "type", "status", "contact_email", "detail", "due_at", "completed_at", "resolution_note"]);
  for (const r of requests) {
    reqCsv += toCsvRow([
      new Date(r.createdAt).toISOString(), r.domain, r.type, r.status, r.email ?? "", r.detail,
      r.dueAt ? new Date(r.dueAt).toISOString() : "", r.completedAt ? new Date(r.completedAt).toISOString() : "",
      r.resolutionNote ?? "",
    ]);
  }
  addEntry("requests.csv", reqCsv);

  // Breach register (DPDP §8(6)): org-wide, with a JSON record per incident that
  // includes the notice snapshots actually sent.
  const incidents = await listIncidents(session.orgId);
  let breachCsv = toCsvRow([
    "detected_at", "domain", "status", "nature", "data_categories", "est_affected",
    "board_notified_at", "principals_notified_at", "remediation",
  ]);
  for (const b of incidents) {
    breachCsv += toCsvRow([
      new Date(b.detectedAt).toISOString(), b.domain ?? "", b.status, b.nature,
      b.dataCategories.join(" "), b.estAffected ?? "",
      b.boardNotifiedAt ? new Date(b.boardNotifiedAt).toISOString() : "",
      b.principalsNotifiedAt ? new Date(b.principalsNotifiedAt).toISOString() : "",
      b.remediation,
    ]);
    const notifications = await listNotifications(session.orgId, b.id);
    addEntry(`breaches/${b.id}.json`, JSON.stringify({ incident: b, notifications }, null, 2));
  }
  if (incidents.length > 0) addEntry("breaches.csv", breachCsv);

  // Erasure obligations (DPDP §8(7)-(8), §12(3)): the record that each erasure
  // duty was tracked and actioned (or noted as not required, with a reason).
  const obligations = await listObligations(session.orgId);
  let erasureCsv = toCsvRow([
    "created_at", "domain", "kind", "status", "subject_id", "source_action", "basis",
    "due_at", "resolved_at", "resolution_note",
  ]);
  for (const o of obligations) {
    erasureCsv += toCsvRow([
      new Date(o.createdAt).toISOString(), o.domain, o.kind, o.status, o.subjectId ?? "",
      o.sourceAction ?? "", o.basis ?? "", new Date(o.dueAt).toISOString(),
      o.resolvedAt ? new Date(o.resolvedAt).toISOString() : "", o.resolutionNote ?? "",
    ]);
  }
  if (obligations.length > 0) addEntry("erasure-obligations.csv", erasureCsv);

  // Parental consents (DPDP §9): pseudonymous evidence that verifiable parental
  // consent was captured. Guardian contact is deliberately omitted here.
  const parental = await listParentalConsentsForOrg(session.orgId);
  let parentalCsv = toCsvRow(["created_at", "domain", "subject_id", "method", "status", "verified_at"]);
  for (const p of parental) {
    parentalCsv += toCsvRow([
      new Date(p.createdAt).toISOString(), p.domain, p.subjectId, p.method, p.status,
      p.verifiedAt ? new Date(p.verifiedAt).toISOString() : "",
    ]);
  }
  if (parental.length > 0) addEntry("parental-consents.csv", parentalCsv);

  // Recipients register (DPDP §11(1)(b), §8(2), §16).
  const recipients = await listRecipientsForOrg(session.orgId);
  let recipientsCsv = toCsvRow([
    "domain", "name", "role", "purpose", "data_shared", "country", "contract_ref", "contract_status",
  ]);
  for (const r of recipients) {
    recipientsCsv += toCsvRow([
      r.domain, r.name, r.role, r.purpose ?? "", r.dataItemKeys.join(" "), r.country ?? "",
      r.contractRef ?? "", r.contractStatus ?? "",
    ]);
  }
  if (recipients.length > 0) addEntry("recipients.csv", recipientsCsv);

  // Processor-cease tasks (DPDP §6(6), §8(7)(b)): when cessation was effected.
  const cessation = await listCessationForOrg(session.orgId);
  let cessationCsv = toCsvRow(["obligation_id", "recipient", "status", "signalled_at", "ack_at", "note"]);
  for (const c of cessation) {
    cessationCsv += toCsvRow([
      c.obligationId, c.recipientName, c.status,
      c.signalledAt ? new Date(c.signalledAt).toISOString() : "",
      c.ackAt ? new Date(c.ackAt).toISOString() : "", c.note ?? "",
    ]);
  }
  if (cessation.length > 0) addEntry("cessation-tasks.csv", cessationCsv);

  // SDF toolkit (DPDP §10): designation, DPIAs, auditor, audit cadence, only
  // meaningful for SDF-designated orgs. Auditor contact omitted (PII).
  const sdf = await getSdfSettings(session.orgId);
  if (sdf.isSdf) {
    const [dpias, auditors, schedule] = await Promise.all([
      listDpia(session.orgId),
      listAuditors(session.orgId),
      getAuditSchedule(session.orgId),
    ]);
    addEntry(
      "sdf/sdf.json",
      JSON.stringify(
        {
          settings: { isSdf: sdf.isSdf, dpoIndiaBased: sdf.dpoIndiaBased, dpoName: sdf.dpoName, dpoEmail: sdf.dpoEmail },
          dpias,
          auditors: auditors.map((a) => ({ name: a.name, firm: a.firm, engagedAt: a.engagedAt })),
          auditSchedule: schedule,
        },
        null,
        2,
      ),
    );
  }

  // Retrospective §5(2) notice delivery log (no raw emails).
  const retroDelivery = await listDeliveryForOrg(session.orgId);
  let retroCsv = toCsvRow(["domain", "batch_id", "status", "sent_at", "error"]);
  for (const d of retroDelivery) {
    retroCsv += toCsvRow([d.domain, d.batchId, d.status, d.sentAt ? new Date(d.sentAt).toISOString() : "", d.error ?? ""]);
  }
  if (retroDelivery.length > 0) addEntry("retro-notice-delivery.csv", retroCsv);

  // Nominations (DPDP §14), pseudonymous (nominee PII omitted).
  const nominations = await listNominationsForExport(session.orgId);
  let nominationsCsv = toCsvRow(["domain", "relationship", "status", "activated_at", "created_at"]);
  for (const n of nominations) {
    nominationsCsv += toCsvRow([
      n.domain, n.relationship ?? "", n.status,
      n.activatedAt ? new Date(n.activatedAt).toISOString() : "", new Date(n.createdAt).toISOString(),
    ]);
  }
  if (nominations.length > 0) addEntry("nominations.csv", nominationsCsv);

  // Recorded exemptions (DPDP §17, §9(4)) per site + a consent-mechanics
  // conformity statement (§6(1)-(2)). Both are evidence/attestation, not data.
  const exemptions: Record<string, { section17: string; section9: string }> = {};
  for (const site of sites) {
    const full = await getSiteForOrg(site.id, session.orgId);
    if (!full) continue;
    const ex = exemptionsFromSettings(full.settings);
    if (ex.section17 || ex.section9) exemptions[site.domain] = ex;
  }
  addEntry(
    "compliance-statements.json",
    JSON.stringify(
      {
        consentMechanics:
          "Non-essential purposes are opt-in and never pre-granted; 'Reject non-essential' is presented as prominently as 'Accept'; consent is not bundled with any waiver of rights (DPDP §6(1)-(2)). Verified by automated test e2e/consent-mechanics.spec.ts.",
        exemptionsRelied: exemptions,
      },
      null,
      2,
    ),
  );

  // Cover sheet last so it can summarise everything above.
  const cover: PdfLine[] = [
    { text: "Skope audit bundle", size: 20, bold: true },
    { text: "" },
    { text: `Organisation: ${gate.org.name}` },
    { text: `Plan: ${gate.limits.label}` },
    { text: `Generated: ${ist.format(generatedAt)} IST, for ${session.email}` },
    { text: "" },
    { text: "Consent ledger", size: 14, bold: true },
  ];
  for (const s of siteReports) {
    cover.push(
      { text: "" },
      { text: s.domain, bold: true },
      { text: `Receipts: ${s.count}${s.truncated ? ` (first ${MAX_RECEIPTS_PER_SITE}, full history via CSV export)` : ""}` },
      { text: `Hash chain: ${s.ok ? "intact" : `BROKEN at seq ${s.brokenAt} (${s.reason ?? "unknown"})`}` },
      { text: `Head: seq ${s.headSeq}${s.headHash ? `, ${s.headHash.slice(0, 32)}...` : " (empty ledger)"}` },
      { text: `Independent verification: ${s.verifyUrl}` },
    );
  }
  cover.push(
    { text: "" },
    { text: `Data-principal requests: ${requests.length} (requests.csv)` },
    { text: `Breach incidents: ${incidents.length}${incidents.length > 0 ? " (breaches.csv + breaches/)" : ""}` },
    { text: `Erasure obligations: ${obligations.length}${obligations.length > 0 ? " (erasure-obligations.csv)" : ""}` },
    { text: `Parental consents: ${parental.length}${parental.length > 0 ? " (parental-consents.csv)" : ""}` },
    { text: `Recipients: ${recipients.length}${recipients.length > 0 ? " (recipients.csv)" : ""}` },
    { text: `Processor-cease tasks: ${cessation.length}${cessation.length > 0 ? " (cessation-tasks.csv)" : ""}` },
    { text: `SDF designation: ${sdf.isSdf ? "yes (sdf/sdf.json)" : "no"}` },
    { text: `Retrospective notice deliveries: ${retroDelivery.length}${retroDelivery.length > 0 ? " (retro-notice-delivery.csv)" : ""}` },
    { text: "" },
    { text: "Contents are listed with SHA-256 checksums in manifest.json.", size: 9 },
    { text: "requests.csv contains decrypted requester contacts. Treat as confidential.", size: 9 },
  );
  addEntry("cover.pdf", buildSimplePdf(cover));

  zip.add("manifest.json", JSON.stringify(manifest, null, 2));

  const date = generatedAt.toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip.finish()), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="skope-audit-bundle-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
