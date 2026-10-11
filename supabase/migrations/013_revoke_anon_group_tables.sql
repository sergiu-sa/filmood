-- Filmood Stage 13 — The group tables leave the anon key
--
-- 001's anon policies are `using (true)`, and 008 and 011 only narrowed the columns, so anyone holding the anon key
-- (every browser) could list every session's join code, every participant's row id (a guest's only credential, which
-- the group routes accept as the caller) and every vote. No client code reads these tables: the group pages go through
-- the service-role routes, and lib/useGroupRealtime.ts uses an event only as a signal to refetch, which the 2 s poll
-- also sends. Realtime refuses an anon subscription whose filter column anon can't read, so a guest's channels stay
-- quiet and the poll carries guests.
--
-- Revoking a table privilege also revokes that table's column grants (008, 011), so anon keeps nothing here.
-- authenticated loses swipes too: nothing reads it (it isn't in the Realtime publication, and results come from the
-- service-role route), and a member could read the others' votes before the results.
-- 008's caveat was wrong: Realtime sends a subscriber only the columns its role can SELECT.

drop policy "Anon can read session by code" on public.sessions;
drop policy "Anon can read participants" on public.session_participants;
drop policy "Anon can read swipes" on public.swipes;
revoke all on public.sessions, public.session_participants, public.swipes from anon;

drop policy "Users can read session swipes" on public.swipes;
revoke all on public.swipes from authenticated;
