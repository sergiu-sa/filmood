-- Filmood Stage 10 — Time on session participants
--
-- The group mood page sends a Time (short / medium / long), the filter solo search uses, instead of the old tempo.
-- `tempo` stays (nullable, no longer written): participants who locked in before this deploy still carry one,
-- and lib/deck.ts reads it as a Time.
--
-- Not granted to anon. 008 grants anon's columns one by one, so a new column isn't readable by default,
-- and only the service-role routes read this one: a participant's picks are private.
--
-- Apply before the code that writes it deploys: the group mood route sets `time` in the same update as the
-- moods, so without the column every lock-in fails.

alter table public.session_participants
  add column if not exists "time" text
    check ("time" is null or "time" in ('short','medium','long'));
