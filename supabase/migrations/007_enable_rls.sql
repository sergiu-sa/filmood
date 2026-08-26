-- Filmood Stage 7 — Enable RLS on remaining public tables
-- Enables RLS on tables exposed to PostgREST to prevent direct public access.
-- No policies are added because all queries use the service-role key which bypasses RLS.

alter table public.watchlists enable row level security;
alter table public.mood_history enable row level security;
alter table public.streaming_preferences enable row level security;
alter table public.film_views enable row level security;
