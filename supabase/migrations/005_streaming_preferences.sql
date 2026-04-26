-- Filmood Stage 5 — Streaming preferences
-- One row per authenticated user; stores the streaming platforms they
-- subscribe to so Filmood can filter recommendations by availability.
--
-- Read + write via /api/streaming-preferences (GET / PUT). No RLS — all
-- access goes through the API route using the service-role key, matching
-- the watchlists / mood_history pattern.
-- Apply after 004_mood_history.sql. Run in Supabase SQL Editor.

create table if not exists public.streaming_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  platforms  text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create index if not exists idx_streaming_preferences_user
  on public.streaming_preferences(user_id);
