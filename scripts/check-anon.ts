#!/usr/bin/env tsx
/**
 * Checks what the public anon key can read in the live database. Run locally, not in CI.
 *
 *   npm run check:anon
 *
 * Lists every table and column the Data API exposes from its OpenAPI root, which only the secret key may read, then
 * asks for each column with the anon key in a count-only HEAD request, so no row is ever printed. Every one must be
 * refused: the group tables since migration 013, the server-only tables since 016, and a new table unless its
 * migration grants anon something. Exits 1 otherwise, or when either key is refused. The URL and both keys are loaded
 * from .env.local.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

async function probe(url: string, key: string, table: string, column: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  // "0-70/71", or "*/0" for no rows; absent when the request is refused.
  const total = res.headers.get("content-range")?.split("/")[1];
  return { column, status: res.status, rows: total === undefined || total === "*" ? null : Number(total) };
}

async function exposedTables(url: string, secretKey: string) {
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: secretKey, Authorization: `Bearer ${secretKey}` } });
  if (!res.ok) throw new Error(`The secret key couldn't read the table list (${res.status}).`);
  const spec = (await res.json()) as { definitions?: Record<string, { properties?: Record<string, unknown> }> };
  return Object.entries(spec.definitions ?? {}).map(([table, def]) => ({ table, columns: Object.keys(def.properties ?? {}) }));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !secretKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exitCode = 1;
    return;
  }

  // The gateway answers a rejected or retired key with 401 too, which would pass every table
  // below. A table that can't exist reaches PostgREST only with a key it accepts: 404.
  const control = await probe(url, key, "check_anon_no_such_table", "id");
  if (control.status !== 404) {
    console.error(`The key didn't reach the database (${control.status} where 404 was expected), so a 401 below would prove nothing.`);
    process.exitCode = 1;
    return;
  }

  const tables = await exposedTables(url, secretKey);
  if (tables.length === 0) {
    console.error("The Data API lists no tables, so there is nothing to check.");
    process.exitCode = 1;
    return;
  }

  let ok = true;
  for (const { table, columns } of tables) {
    const results = await Promise.all(columns.map((c) => probe(url, key, table, c)));
    const failed = results.filter((r) => r.status !== 401);
    ok &&= failed.length === 0;
    console.log(`${failed.length ? "FAIL" : "ok  "}  ${table.padEnd(22)} ${columns.length} columns, all refused`);
    for (const r of failed) console.log(`        ${r.column}: ${r.status}, ${r.rows ?? "?"} rows`);
  }

  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
