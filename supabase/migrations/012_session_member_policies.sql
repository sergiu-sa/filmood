-- Filmood Stage 12 — Authenticated group policies that can evaluate
--
-- 001's authenticated SELECT policies query the group tables under RLS: session_participants' policy reads
-- session_participants, sessions' reads session_participants (whose policy reads sessions), swipes' reads
-- session_participants. Postgres refuses every signed-in read with 42P17 (infinite recursion), so signed-in
-- Realtime on the group pages never fired and the 2 s poll carried it.
--
-- One security-definer check replaces the subqueries: it runs as its owner, which bypasses RLS on these tables,
-- so it reads them without re-entering their policies. It lives in a schema the Data API doesn't expose, so it
-- can't be called as an RPC, and only authenticated can execute it. 011's column grants are unchanged.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_session_member(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.sessions s where s.id = sid and s.host_id = (select auth.uid()))
      or exists (select 1 from public.session_participants p where p.session_id = sid and p.user_id = (select auth.uid()));
$$;

-- anon and service_role are named too: a default privilege granted to them directly survives a revoke from public.
revoke all on function private.is_session_member(uuid) from public, anon, service_role;
grant execute on function private.is_session_member(uuid) to authenticated;

drop policy "Users can read own sessions" on public.sessions;
create policy "Users can read own sessions" on public.sessions
  for select to authenticated using (private.is_session_member(id));

drop policy "Users can read session participants" on public.session_participants;
create policy "Users can read session participants" on public.session_participants
  for select to authenticated using (private.is_session_member(session_id));

drop policy "Users can read session swipes" on public.swipes;
create policy "Users can read session swipes" on public.swipes
  for select to authenticated using (private.is_session_member(session_id));
