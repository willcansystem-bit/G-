import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL)
  throw new Error(
    "Configure DATABASE_URL no ambiente para aplicar a migração. Não salve credenciais no repositório.",
  );
const sql = postgres(process.env.DATABASE_URL, {
  max: 1,
  ssl: process.env.DB_SSL === "disable" ? false : "require",
});
try {
  await sql`select pg_advisory_lock(611060001)`;
  await sql`create table if not exists public.giro_schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  await sql`revoke all on public.giro_schema_migrations from public, anon, authenticated`;
  for (const name of ["202611060001_giro_community.sql", "202611060002_guest_news_limit.sql"]) {
    const applied = await sql`select name from public.giro_schema_migrations where name=${name}`;
    if (!applied.length) {
      const migration = await readFile(
        new URL(`../supabase/migrations/${name}`, import.meta.url),
        "utf8",
      );
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration.replace(/^begin;\s*/i, "").replace(/commit;\s*$/i, ""));
        await transaction`insert into public.giro_schema_migrations(name) values(${name})`;
      });
      console.log(`Migração ${name} aplicada.`);
    } else console.log(`Migração ${name} já aplicada.`);
  }
} finally {
  await sql.end();
}
