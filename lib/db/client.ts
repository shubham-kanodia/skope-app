import postgres from "postgres";

/**
 * Supabase Postgres client.
 *
 * We connect through the **transaction pooler** (port 6543), which multiplexes
 * connections and therefore does NOT support prepared statements, hence
 * `prepare: false`. The same `DATABASE_URL` works for serverless (Vercel)
 * because the pooler keeps the per-request connection count low.
 *
 * Like skope-landing-page/lib/leads.ts, this is the single seam every query
 * goes through, so swapping pooler/direct/region later touches one file.
 */
declare global {
  // Reuse the client across hot reloads in dev to avoid exhausting connections.
  var __skopeSql: ReturnType<typeof postgres> | undefined;
}

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and add your Supabase connection string.",
    );
  }
  return postgres(url, {
    prepare: false, // required for Supabase transaction pooler (6543)
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
}

export const sql = globalThis.__skopeSql ?? create();

if (process.env.NODE_ENV !== "production") {
  globalThis.__skopeSql = sql;
}
