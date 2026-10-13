-- Filmood Stage 17 — One seat per signed-in user in a session
--
-- Join looks the seat up, then inserts, so two joins by the same signed-in user at the same moment both inserted, and
-- every group route then answered them 500 (resolveParticipant reads the seat with maybeSingle). Now the second insert
-- fails with 23505 and join answers with the seat the first one made. Guest seats have no user_id and stay out.
-- 014's index on user_id alone still serves the account-delete cascade; this one leads with session_id, as join and
-- private.is_session_member (012) look a seat up. An index needs no grants (016).
--
-- There were no duplicate pairs to remove on 2026-10-13.

create unique index if not exists session_participants_session_id_user_id_key
  on public.session_participants (session_id, user_id)
  where user_id is not null;
