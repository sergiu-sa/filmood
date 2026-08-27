-- Filmood Stage 8 — Stop leaking account UUIDs to the public anon key
--
-- The anon SELECT policies on these tables (migration 001) are USING (true):
-- necessary so guests and Realtime can read a session by code without logging in.
-- But "read the row" also meant "read host_id / user_id" — the real auth.users UUIDs — to anyone holding the anon key (i.e. every browser).
-- A single anon REST call returned every account UUID in the project.
--
-- RLS decides which ROWS a role sees; column privileges decide which COLUMNS.
-- A column-level REVOKE has no effect while the role still holds a table-wide SELECT grant (Supabase's default), so we drop the table grant and re-grant exactly the columns anon is allowed to read — everything except the UUIDs.
--
-- The server routes use the service-role key, which bypasses column privileges entirely;
--  every REST read of these tables goes through those routes, so app behaviour is unchanged.
-- Caveat: Realtime `postgres_changes` payloads are produced from the replication stream and may still carry the omitted columns to a subscriber the RLS row policy admits — this closes the bulk REST harvest, which was the exposure.
--Scoping the anon row policies by code is the follow-up if the Realtime path needs the same guarantee.)
--
-- Keep this list in sync when adding an anon-readable column to either table;
-- a new column is NOT granted to anon automatically.

-- sessions: every column except host_id
revoke select on public.sessions from anon;
grant select (id, code, status, movie_deck, created_at)
  on public.sessions to anon;

-- session_participants: every column except user_id
revoke select on public.session_participants from anon;
grant select (
  id, session_id, nickname, mood_selections, has_swiped, joined_at,
  is_ready, mood_text, era, tempo, extra_keywords
) on public.session_participants to anon;
