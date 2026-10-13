-- Filmood Stage 15 — A film is saved once per user
--
-- watchlists had no unique (user_id, movie_id), so two quick saves could store a film twice. /api/watchlist/add now
-- inserts with `on conflict do nothing` against this index, which needs it to exist: apply before deploying that route.
-- Leading with user_id, it also indexes the foreign key to auth.users that an account delete cascades through.
--
-- The delete keeps each pair's earliest save; there were none to remove on 2026-10-13.

delete from public.watchlists w
using public.watchlists keep
where keep.user_id = w.user_id
  and keep.movie_id = w.movie_id
  and (keep.added_at, keep.id) < (w.added_at, w.id);

create unique index if not exists watchlists_user_id_movie_id_key on public.watchlists (user_id, movie_id);
