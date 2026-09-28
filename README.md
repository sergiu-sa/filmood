# Filmood

**Tell Filmood how you want to feel. It tells you what to watch — alone or as a group.**

🔗 **Live demo:** [filmood-pi.vercel.app](https://filmood-pi.vercel.app/)

Filmood starts from how you want to feel rather than from a catalogue. Pick a mood and it returns films that fit, drawn from what's streaming on Norwegian subscription services. With friends, everyone picks a mood in private, the group swipes through a shared deck, and the app picks a winner from everyone's votes.

## Features

**Solo**
- **12 moods**, from *Need to laugh* to *Bend my mind*. Combine several, narrow by era, tempo, runtime, language or genres to skip, or describe what you want in your own words ("cozy 80s heist").
- **Search and browse.** Search by title, actor or director. Browse trending, top rated, new releases, in cinemas, by genre, or streaming in Norway.
- **Film pages.** Cast and crew, trailers and clips, an image gallery, where to stream it in any country (with local age rating and release date), similar films, reviews and external links.
- **Profile.** Your top moods and genres, films you opened but didn't save, an activity timeline, your saved films, your streaming services, and account settings.
- **Guests welcome.** Everything except saving films and the profile works without an account.

**Group sessions**
- The host creates a session and shares a 6-character code. Up to 10 people join; guests only need a nickname.
- Everyone picks moods in private. The app builds one 15-film deck from all the picks.
- Everyone swipes yes / no / maybe, and progress syncs live.
- Votes rank the films into *Perfect Match*, *Strong contenders* and *Not tonight*, with one Top Pick.

**Design:** dark and light themes, six mood accent colours, Lora and Plus Jakarta Sans, and bottom sheets on mobile.

## Tech stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase (auth, Postgres, Realtime) · TMDB API v3 · Zod 4 · Vitest 4 + React Testing Library · Playwright · Vercel

## How it works

- **The TMDB key never reaches the browser.** All film data goes through the app's own `/api/movies/*` routes, and one helper (`lib/tmdb-fetch.ts`) owns the key, URL building and caching. Upstream failures surface as errors instead of empty results.
- **Moods are measured, not guessed.** Each mood is pure data turned into a TMDB query. `npm run check:moods` runs every mood against live TMDB, and prints how many films each one returns; `--keywords` verifies every keyword ID by name.
- **Group sessions work for guests.** Guests carry a participant ID in `localStorage`; signed-in users send a Supabase JWT. One pair of helpers in `lib/group-api.ts` resolves both.
- **Realtime with a safety net.** Supabase Realtime pushes session and participant changes, and a 2-second poll covers dropped connections and swipe counts.
- **Optimistic swipes.** A vote leaves the screen immediately. A failed request retries once instead of snapping the card back.

## Run it locally

You need Node.js 20 (pinned in `.nvmrc`), a free [TMDB API key](https://www.themoviedb.org/settings/api) and a free [Supabase](https://supabase.com) project.

```bash
git clone https://github.com/sergiu-sa/filmood.git
cd filmood
npm install
cp .env.example .env.local   # then fill in the four values
npm run dev                  # http://localhost:3000
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` (the project URL, without `/rest/v1`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `TMDB_API_KEY`. The last two are server-only.

**Database:** in the Supabase SQL editor, run every file in `supabase/migrations/` in numeric order. They create the watchlist, group session, mood history, streaming preference and film view tables and lock them down with row-level security. `supabase/seed_group_session.sql` adds optional sample data for trying the group flow.

### Scripts

```bash
npm run lint                  # ESLint
npm run typecheck             # tsc (app code; typecheck:tests for test code)
npm test                      # Vitest unit and component tests
npm run test:e2e              # Playwright (starts the dev server itself)
npm run check:moods           # Mood coverage against live TMDB (needs TMDB_API_KEY)
npm run seed:e2e-user         # Creates the Supabase user the e2e suite logs in as
```

The e2e suite reads its login from `.env.test.local`; copy `.env.test.example` and run `npm run seed:e2e-user` once.

## Deploying

It deploys to Vercel as a standard Next.js project.
- Set the four environment variables for Production, Preview and Development. Env changes only apply to new builds.
- In Supabase, set **Authentication → URL Configuration → Site URL** to the production domain so sign-up confirmation links work.
- Apply any new migration in Supabase before deploying code that depends on it.

## Project structure

```
app/            Pages (home, results, film/[id], browse, group, profile, auth) and api/ route handlers
components/     UI, grouped by area: dashboard, film, group, profile, results, mood, ui
lib/            Mood data and queries, TMDB and Supabase helpers, deck builder, hooks
supabase/       SQL migrations and optional seed data
scripts/        check-moods, e2e user seeding, signature poster fetch
tests/e2e/      Playwright specs and TMDB stubs
```

## License

This project is a student submission and is not licensed for commercial use. Movie data is provided by [The Movie Database (TMDB)](https://www.themoviedb.org) — this product uses the TMDB API but is not endorsed or certified by TMDB.
