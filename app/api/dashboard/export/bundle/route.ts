import { createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { getOrgGate } from "@/lib/billing/gate";
import { listSites } from "@/lib/orgs/queries";
import { listReceiptsForExport, type ExportCursor } from "@/lib/consent/list";
import { listRequestsForExport } from "@/lib/requests/store";
import { listPublishedNotices } from "@/lib/notices/store";
import { verifySiteChain, ledgerHead } from "@/lib/consent/verify";
import { toCsvRow } from "@/lib/export/csv";
import { ZipBuilder } from "@/lib/export/zip";
import { buildSimplePdf, type PdfLine } from "@/lib/export/pdf";
import { renderNoticeHtml } from "@/lib/export/notice-html";

export const runtime = "nodejs";

// Stored-entry zips buffer each file, so bound the bundle; full history is
// always available through the streaming CSV export. Stated on the cover sheet.
const MAX_RECEIPTS_PER_SITE = 250_000;

const RECEIPT_HEADER = [
  "occurred_at", "domain", "seq", "action", "method", "purposes_granted",
  "purposes_denied", "notice_version", "language", "region", "row_hash",
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
      { error: "Audit bundles are on the Growth plan. Your consent data is always yours — CSV export stays available." },
      { status: 403 },
    );
  }

  const wantedSite = new URL(request.url).searchParams.get("site");
  let sites = await listSites(session.orgId);
  if (wantedSite && wantedSite !== "all") sites = sites.filter((s) => s.id === wantedSite);
  if (sites.length === 0) return Response.json({ error: "Site not found." }, { status: 404 });

  await sql`
    insert into audit_log (org_id, actor_user_id, action, target)
    values (${session.orgId}, ${session.userId}, 'export.bundle', ${wantedSite ?? "all"})`;

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
          r.notice_version ?? "", r.language_shown ?? "", r.region ?? "", r.row_hash_hex,
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
      { text: `Receipts: ${s.count}${s.truncated ? ` (first ${MAX_RECEIPTS_PER_SITE} — full history via CSV export)` : ""}` },
      { text: `Hash chain: ${s.ok ? "intact" : `BROKEN at seq ${s.brokenAt} (${s.reason ?? "unknown"})`}` },
      { text: `Head: seq ${s.headSeq}${s.headHash ? `, ${s.headHash.slice(0, 32)}...` : " (empty ledger)"}` },
      { text: `Independent verification: ${s.verifyUrl}` },
    );
  }
  cover.push(
    { text: "" },
    { text: `Data-principal requests: ${requests.length} (requests.csv)` },
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
