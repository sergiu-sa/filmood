-- Filmood Stage 6 — Film views
-- One row per film-detail-page view by an authenticated user. Powers the
-- profile "Continue researching" rail — recently-opened films the user
-- hasn't yet saved or rated.
--
-- Recorded fire-and-forget by /api/movies/[id] for authenticated callers
-- (guests skipped). Read via GET /api/film-views, which returns the most
-- recent N distinct films for the signed-in user. No RLS — service-role
-- access only, matching the watchlists / mood_history pattern.
-- Apply after 005_streaming_preferences.sql. Run in Supabase SQL Editor.

create table if not exists public.film_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  movie_id   integer not null,
  movie_title text not null,
  poster_path text,
  viewed_at  timestamptz not null default now()
);

-- Supports "most recent distinct films per user" queries.
create index if not exists idx_film_views_user_viewed
  on public.film_views(user_id, viewed_at desc);

-- Reasonable retention: trim per-user history to the last 100 events on
-- write to keep the table small (older rows pruned by the API helper).
