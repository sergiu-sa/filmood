#!/usr/bin/env tsx
/**
 * Checks what the public anon key can read in the live database. Run locally, not in CI.
 *
 *   npm run check:anon
 *
 * Asks for every column of every public table with a count-only HEAD request, so no row is
 * ever printed. The group tables must refuse anon outright (migration 013). The server-only
 * tables may answer, but with no rows (RLS on, no policies). Exits 1 otherwise, when a
 * column below no longer exists, or when the key itself is refused. The URL and anon key are
 * loaded from .env.local.
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

// Every column, as the migrations define them. A new table or column belongs here too: one
// column granted to anon is enough to read it, whatever the rest refuse.
const GROUP_TABLES: Record<string, string[]> = {
  sessions: ["id", "code", "host_id", "status", "movie_deck", "created_at"],
  session_participants: [
    "id", "session_id", "user_id", "nickname", "mood_selections", "has_swiped", "joined_at",
    "is_ready", "mood_text", "era", "tempo", "extra_keywords", "time",
  ],
  swipes: ["id", "session_id", "participant_id", "movie_id", "vote", "created_at"],
};
const SERVER_TABLES: Record<string, string[]> = {
  watchlists: ["id", "user_id", "movie_id", "movie_title", "poster_path", "added_at"],
  mood_history: ["id", "user_id", "mood", "picked_at"],
  streaming_preferences: ["user_id", "platforms", "updated_at"],
  film_views: ["id", "user_id", "movie_id", "movie_title", "poster_path", "viewed_at"],
  search_events: [
    "id", "created_at", "moods", "filters", "has_text", "source", "result_count", "relaxed",
    "partial", "suggestions_shown",
  ],
};

async function probe(url: string, key: string, table: string, column: string) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${column}`, {
    method: "HEAD",
    headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  // "0-70/71", or "*/0" for no rows; absent when the request is refused.
  const total = res.headers.get("content-range")?.split("/")[1];
  return { column, status: res.status, rows: total === undefined || total === "*" ? null : Number(total) };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
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

  let ok = true;
  const check = async (tables: Record<string, string[]>, passes: (status: number, rows: number | null) => boolean, want: string) => {
    for (const [table, columns] of Object.entries(tables)) {
      const results = await Promise.all(columns.map((c) => probe(url, key, table, c)));
      // 400 is PostgREST's "no such column": the map above is stale, which would hide a column.
      const failed = results.filter((r) => r.status === 400 || !passes(r.status, r.rows));
      ok &&= failed.length === 0;
      console.log(`${failed.length ? "FAIL" : "ok  "}  ${table.padEnd(22)} ${columns.length} columns, ${want}`);
      for (const r of failed) {
        console.log(`        ${r.column}: ${r.status === 400 ? "400, no such column" : `${r.status}, ${r.rows ?? "?"} rows`}`);
      }
    }
  };

  await check(GROUP_TABLES, (status) => status === 401, "all refused");
  await check(SERVER_TABLES, (status, rows) => status === 401 || (status === 200 && rows === 0), "refused or no rows");

  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
