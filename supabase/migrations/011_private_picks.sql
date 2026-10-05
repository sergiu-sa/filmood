-- Filmood Stage 11 — Keep each participant's picks private
--
-- 008 left the picks (moods, text, era, tempo, keywords) readable by anon, so any browser holding the anon key could
-- read every session's picks, and authenticated kept its table-wide grant, under a page that says "Your picks are private".
-- No client code needs them: the group pages read through the service-role routes, and lib/useGroupRealtime.ts only
-- uses a Realtime event as a signal to refetch. The service role is unaffected.
--
-- anon has had column grants since 008, so its five columns are revoked directly. authenticated still holds the
-- table-wide grant, which a column revoke can't narrow, so it gets 008's pattern. It keeps user_id and session_id:
-- its RLS policy and the Realtime filter read them. `time` (010) is granted to neither.
-- Keep both lists in sync when adding a column either role should read.

revoke select (mood_selections, mood_text, era, tempo, extra_keywords)
  on public.session_participants from anon;

revoke select on public.session_participants from authenticated;
grant select (id, session_id, user_id, nickname, has_swiped, joined_at, is_ready)
  on public.session_participants to authenticated;
