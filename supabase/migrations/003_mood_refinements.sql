-- Filmood Stage 3 — Mood refinements on session participants
-- Adds optional era/tempo/text/extra_keywords columns so the group flow
-- can persist each participant's refinement choices alongside their mood tiles.
-- Apply after 002_add_is_ready.sql. Run in Supabase SQL Editor.
-- All columns are additive and nullable (or defaulted) — safe for existing rows.

alter table public.session_participants
  add column if not exists mood_text text,
  add column if not exists era text
    check (era is null or era in ('classic','modern','fresh')),
  add column if not exists tempo text
    check (tempo is null or tempo in ('slowburn','fastpaced')),
  add column if not exists extra_keywords integer[] not null default '{}';
