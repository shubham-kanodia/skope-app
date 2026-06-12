import { createHash } from "node:crypto";
import { sql } from "@/lib/db/client";
import { translateBatch } from "@/lib/translate/google";
import { coercePolicyContent, type PolicyContent } from "@/lib/policy/types";

/**
 * Versioned privacy notices, stored in the notices table. Each generated draft
 * is a new version (published_at = null) until published. content_i18n holds the
 * notice per language: { en: PolicyContent, hi: PolicyContent, ... }.
 *
 * Published versions are the audit trail of what visitors were shown; we never
 * mutate a published row (we add a new version instead). Drafts can be edited in
 * place until publish.
 */
export interface NoticeRow {
  version: number;
  contentI18n: Record<string, PolicyContent>;
  publishedAt: string | null;
  checksum: string | null;
  createdAt: string;
}

function rowToNotice(row: Record<string, unknown>): NoticeRow {
  return {
    version: Number(row.version),
    contentI18n: (row.content_i18n ?? {}) as Record<string, PolicyContent>,
    publishedAt: (row.published_at as string | null) ?? null,
    checksum: (row.checksum as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

/** The newest notice for a site, published or draft. */
export async function getLatestNotice(siteId: string): Promise<NoticeRow | null> {
  const rows = await sql`
    select version, content_i18n, published_at, checksum, created_at
    from notices where site_id = ${siteId} order by version desc limit 1`;
  return rows[0] ? rowToNotice(rows[0]) : null;
}

/** The newest published notice (what the public privacy page renders). */
export async function getLatestPublishedNotice(siteId: string): Promise<NoticeRow | null> {
  const rows = await sql`
    select version, content_i18n, published_at, checksum, created_at
    from notices where site_id = ${siteId} and published_at is not null
    order by version desc limit 1`;
  return rows[0] ? rowToNotice(rows[0]) : null;
}

/** Every published version, oldest first — the audit bundle ships them all. */
export async function listPublishedNotices(siteId: string): Promise<NoticeRow[]> {
  const rows = await sql`
    select version, content_i18n, published_at, checksum, created_at
    from notices where site_id = ${siteId} and published_at is not null
    order by version asc`;
  return rows.map(rowToNotice);
}

/** Published notice version for the cfg endpoint (drives banner re-prompt). */
export async function getPublishedNoticeVersion(siteId: string): Promise<number> {
  const rows = await sql`
    select version from notices where site_id = ${siteId} and published_at is not null
    order by version desc limit 1`;
  return rows[0] ? Number(rows[0].version) : 1;
}

function checksumOf(contentI18n: Record<string, PolicyContent>): string {
  return createHash("sha256").update(JSON.stringify(contentI18n)).digest("hex");
}

/**
 * Save a draft: if the latest notice is an unpublished draft, update it in place;
 * otherwise create the next version. Returns the saved draft.
 */
export async function saveDraft(
  siteId: string,
  contentI18n: Record<string, PolicyContent>,
): Promise<NoticeRow> {
  const latest = await getLatestNotice(siteId);
  if (latest && latest.publishedAt === null) {
    const rows = await sql`
      update notices set content_i18n = ${sql.json(JSON.parse(JSON.stringify(contentI18n)))}, checksum = null
      where site_id = ${siteId} and version = ${latest.version}
      returning version, content_i18n, published_at, checksum, created_at`;
    return rowToNotice(rows[0]);
  }
  const nextVersion = (latest?.version ?? 0) + 1;
  const rows = await sql`
    insert into notices (site_id, version, content_i18n)
    values (${siteId}, ${nextVersion}, ${sql.json(JSON.parse(JSON.stringify(contentI18n)))})
    returning version, content_i18n, published_at, checksum, created_at`;
  return rowToNotice(rows[0]);
}

/** Publish the latest draft (set published_at + checksum). Returns it, or null if no draft. */
export async function publishLatestDraft(siteId: string): Promise<NoticeRow | null> {
  const latest = await getLatestNotice(siteId);
  if (!latest || latest.publishedAt !== null) return null;
  const checksum = checksumOf(latest.contentI18n);
  const rows = await sql`
    update notices set published_at = now(), checksum = ${checksum}
    where site_id = ${siteId} and version = ${latest.version}
    returning version, content_i18n, published_at, checksum, created_at`;
  return rowToNotice(rows[0]);
}

/**
 * Translate an English PolicyContent into the target language via Google
 * Translate. Batches every string in one request, order preserved. Throws if
 * the API key is unset, callers decide whether to skip.
 */
export async function translatePolicy(
  source: PolicyContent,
  target: string,
  sourceLang: string,
): Promise<PolicyContent> {
  const strings: string[] = [source.title, source.intro];
  for (const s of source.sections) {
    strings.push(s.heading, s.body);
  }
  const out = await translateBatch(strings, target, sourceLang);
  const translated: PolicyContent = {
    title: out[0] ?? source.title,
    intro: out[1] ?? source.intro,
    sections: source.sections.map((s, i) => ({
      heading: out[2 + i * 2] ?? s.heading,
      body: out[3 + i * 2] ?? s.body,
    })),
  };
  return coercePolicyContent(translated) ?? source;
}

/**
 * Build the per-language content map: the English source plus a translation for
 * each other enabled language. Translation failures degrade gracefully, the
 * language falls back to the English source rather than blocking the draft.
 * Also reports Google Translate usage (source chars × languages actually sent,
 * what Google bills) so callers can surface it to analytics.
 */
export async function buildContentI18nTracked(
  english: PolicyContent,
  languages: string[],
): Promise<{
  contentI18n: Record<string, PolicyContent>;
  translateChars: number;
  translatedLanguages: number;
}> {
  const sourceLang = languages[0] ?? "en";
  const sourceChars =
    english.title.length +
    english.intro.length +
    english.sections.reduce((n, s) => n + s.heading.length + s.body.length, 0);
  const out: Record<string, PolicyContent> = { [sourceLang]: english };
  let translateChars = 0;
  let translatedLanguages = 0;
  for (const lang of languages.slice(1)) {
    try {
      out[lang] = await translatePolicy(english, lang, sourceLang);
      translateChars += sourceChars;
      translatedLanguages += 1;
    } catch (err) {
      console.error(`[notices] translate to ${lang} failed, using source`, err);
      out[lang] = english;
    }
  }
  return { contentI18n: out, translateChars, translatedLanguages };
}

export async function buildContentI18n(
  english: PolicyContent,
  languages: string[],
): Promise<Record<string, PolicyContent>> {
  return (await buildContentI18nTracked(english, languages)).contentI18n;
}
