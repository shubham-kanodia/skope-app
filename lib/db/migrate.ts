/**
 * Minimal forward-only migration runner.
 *
 *   pnpm migrate
 *
 * Applies every migrations/*.sql in lexical order, once each, tracked in
 * schema_migrations. Each file runs in a single simple-protocol batch (the
 * transaction pooler requires simple mode for multi-statement SQL).
 */
import "./load-env";
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "..", "migrations");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || url.includes("[YOUR-PASSWORD]")) {
    console.error(
      "\n✗ DATABASE_URL is missing or still has the [YOUR-PASSWORD] placeholder.\n" +
        "  Add your Supabase password to skope-app/.env, then run `pnpm migrate` again.\n",
    );
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1, connect_timeout: 15 });

  try {
    await sql.unsafe(
      `create table if not exists schema_migrations (
         name text primary key,
         applied_at timestamptz not null default now()
       )`,
    );

    const applied = new Set(
      (await sql`select name from schema_migrations`).map((r) => r.name as string),
    );

    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const content = await readFile(join(migrationsDir, file), "utf8");
      process.stdout.write(`→ applying ${file} ... `);
      await sql.unsafe(content).simple();
      await sql`insert into schema_migrations (name) values (${file})`;
      console.log("ok");
      ran++;
    }

    console.log(ran === 0 ? "✓ already up to date" : `✓ applied ${ran} migration(s)`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("\n✗ migration failed:", err.message ?? err);
  process.exit(1);
});
