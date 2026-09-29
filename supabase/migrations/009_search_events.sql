-- Filmood Stage 9 — Anonymous search-outcome log
--
-- One row per mood search (GET /api/movies/discover), written fire-and-forget by lib/searchLog.ts, so the share of searches that come back empty can be measured and the suggestion buttons judged by whether they rescue them.
--
-- Anonymous by design: no user id, no IP, no free text (only `has_text`). `filters` holds applied filter values from allow-lists, never raw input.
--
-- Only the service role reads or writes it. RLS with no policies blocks anon and authenticated (the 007 pattern);
-- Supabase's default privileges still grant new public tables to both roles, so the revoke makes that explicit (same intent as 008).

create table public.search_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  moods text[] not null,
  filters jsonb not null default '{}'::jsonb,   -- applied time/era/where only
  has_text boolean not null default false,
  source text not null default 'direct'
    check (source in ('direct','tile','text','suggestion','related','shuffle','filter')),
  result_count smallint not null,
  relaxed smallint not null,
  partial boolean not null default false,
  suggestions_shown boolean not null default false
);
alter table public.search_events enable row level security;   -- no policies: service role only (the 007 pattern)
-- Supabase's default privileges grant new public tables to anon/authenticated; RLS already blocks them,
-- this makes it explicit (same intent as 008).
revoke all on public.search_events from anon, authenticated;
create index search_events_created_at_idx on public.search_events (created_at desc);
