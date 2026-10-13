-- Filmood Stage 14 — Deleting an account takes its group sessions with it
--
-- 001 referenced auth.users from sessions.host_id and session_participants.user_id with no `on delete` rule, so
-- auth.admin.deleteUser refused anyone who had hosted or joined a session while signed in ("Database error deleting
-- user"). Now it deletes the sessions they hosted (participants and swipes cascade from those, 001) and their seat and
-- votes in everyone else's. Not `set null`: a seat with no user_id is a guest seat, which anyone holding the code can
-- act as.
--
-- A cascade finds the child rows by these columns, so each gets an index; private.is_session_member (012) reads the
-- first two as well. 001's swipes indexes lead with session_id, which doesn't serve a lookup by participant.

alter table public.sessions
  drop constraint sessions_host_id_fkey,
  add constraint sessions_host_id_fkey
    foreign key (host_id) references auth.users (id) on delete cascade;

alter table public.session_participants
  drop constraint session_participants_user_id_fkey,
  add constraint session_participants_user_id_fkey
    foreign key (user_id) references auth.users (id) on delete cascade;

create index if not exists sessions_host_id_idx on public.sessions (host_id);
create index if not exists session_participants_user_id_idx on public.session_participants (user_id);
create index if not exists swipes_participant_id_idx on public.swipes (participant_id);
