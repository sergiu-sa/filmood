-- Filmood Stage 16 — New tables and functions start closed to the Data API
--
-- Supabase's default privileges handed every table, sequence and function that postgres creates in public to anon,
-- authenticated and service_role, so a migration that forgot RLS published its table to the public key. From here a
-- migration that adds a table or function grants each role what it needs, service_role included, since every route
-- uses it: `grant select, insert, update, delete on public.<table> to service_role;`, plus `grant usage` on any
-- sequence its columns draw from. Supabase applies the same default to existing projects on 2026-10-30.
--
-- EXECUTE for PUBLIC is Postgres's own global default, which a per-schema revoke can't remove, hence the global form.
--
-- watchlists, mood_history, streaming_preferences and film_views were kept from anon and authenticated by RLS alone
-- (007); only the service role reads them. authenticated keeps its SELECT on sessions and session_participants, which
-- its policies and Realtime need, and loses the writes: only the service-role routes write the group tables.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;
alter default privileges for role postgres
  revoke execute on functions from public;

revoke all on public.watchlists, public.mood_history, public.streaming_preferences, public.film_views
  from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.sessions, public.session_participants
  from authenticated;
