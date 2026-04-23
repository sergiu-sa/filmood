-- Filmood Stage 4 — Mood history
-- One row per mood pick by an authenticated user. Populated (fire-and-forget)
-- by /api/movies/discover and /api/group/[code]/mood when the caller is
-- authenticated. Guest picks are not recorded.
--
-- Read via GET /api/mood-history, which aggregates the top-N moods by count
-- for the signed-in user. No RLS is enabled — same pattern as watchlists:
-- all access goes through API routes using the service-role key.
-- Apply after 003_mood_refinements.sql. Run in Supabase SQL Editor.

create table if not exists public.mood_history (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  mood      text not null,
  picked_at timestamptz not null default now()
);

-- Supports the GET /api/mood-history query: filter by user, order by count.
create index if not exists idx_mood_history_user on public.mood_history(user_id);
