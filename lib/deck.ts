import { normalizeMoodKeys } from "@/lib/moodMap";
import { EMPTY_FILTERS, LEGACY_TEMPO_TIME, type Filters } from "@/lib/moodFilters";
import { searchCap, searchMood } from "@/lib/moodSearch";
import { mulberry32, newSeed } from "@/lib/seededRandom";
import { settleTMDB } from "@/lib/tmdb-fetch";
import type { DeckFilm, EraKey, TempoKey, TimeKey } from "@/lib/types";

const DECK_SIZE = 15;
const MIN_DECK_SIZE = 5;
// Cap how many text-derived keyword IDs we union across the group: they're ORed
// with each mood's own keywords, so a large group's would dilute every mood.
const MAX_SHARED_EXTRA_KEYWORDS = 3;

interface ParticipantInput {
  mood_selections: string[] | null;
  era?: EraKey | null;
  time?: TimeKey | null;
  /** Participants who locked in before migration 010. */
  tempo?: TempoKey | null;
  extra_keywords?: number[] | null;
}

/** The group's picks leave too few films; the picks have to change, so a retry as-is won't help. */
export class DeckTooThinError extends Error {
  constructor(readonly size: number) {
    super(`Only ${size} films fit the group's picks`);
    this.name = "DeckTooThinError";
  }
}

// Majority vote across participant values. Ties (or all null) return null —
// we'd rather skip the filter than impose a minority preference on the group.
function majorityVote<T extends string>(values: (T | null | undefined)[]): T | null {
  const counts = new Map<T, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (entries.length > 1 && entries[0][1] === entries[1][1]) return null;
  return entries[0][0];
}

function topKeywords(participants: ParticipantInput[], limit: number): number[] {
  const counts = new Map<number, number>();
  for (const p of participants) {
    for (const k of p.extra_keywords ?? []) {
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

/**
 * Aggregate all participants' moods with weighted frequency, fetch films
 * from TMDB, and build a balanced deck. Each film is tagged with genre_ids
 * and the mood(s) it was sourced from. Era and Time are majority votes,
 * text-derived keywords a capped union, Where the group's saved services
 * (else Norway), and one family pick caps every pool.
 */
export async function buildSharedDeck(
  participants: ParticipantInput[],
  /** The group's saved services as TMDB ids (`groupProviders`); none means Norway. */
  providers: number[] = [],
): Promise<DeckFilm[]> {
  // Count mood frequency across all participants
  const moodCounts: Record<string, number> = {};
  for (const p of participants) {
    if (!p.mood_selections) continue;
    // Sessions that locked in before a mood was retired still carry its key.
    for (const mood of normalizeMoodKeys(p.mood_selections)) {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
  }

  const totalWeight = Object.values(moodCounts).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) throw new Error("No valid moods to build a deck from");

  // Allocate film slots proportionally
  const allocations: { mood: string; count: number }[] = [];
  let allocated = 0;

  const sortedMoods = Object.entries(moodCounts).sort((a, b) => b[1] - a[1]);

  for (const [mood, weight] of sortedMoods) {
    const share = Math.max(1, Math.round((weight / totalWeight) * DECK_SIZE));
    allocations.push({ mood, count: share });
    allocated += share;
  }

  // Adjust to hit exactly DECK_SIZE films, trimming from the least popular moods first
  while (allocated > DECK_SIZE) {
    let trimmed = false;
    for (let i = allocations.length - 1; i >= 0; i--) {
      if (allocations[i].count > 1) {
        allocations[i].count--;
        allocated--;
        trimmed = true;
        break;
      }
    }
    if (!trimmed) {
      allocations.pop();
      allocated--;
    }
  }
  while (allocated < DECK_SIZE) {
    allocations[0].count++;
    allocated++;
  }

  const groupFilters: Filters = {
    ...EMPTY_FILTERS,
    era: majorityVote(participants.map((p) => p.era ?? null)),
    time: majorityVote(participants.map((p) => p.time ?? (p.tempo ? LEGACY_TEMPO_TIME[p.tempo] : null))),
    where: providers.length > 0 ? "mine" : "norway",
    providers,
    extraKeywords: topKeywords(participants, MAX_SHARED_EXTRA_KEYWORDS),
  };
  const cap = searchCap(Object.keys(moodCounts));
  // A deck is built once and stored, so it needs no reproducible seed.
  const rng = mulberry32(newSeed());

  // Search each unique mood in parallel, on the same ladder as solo results.
  const fetchResults = allocations.map(async ({ mood, count }) => {
    const pool = await searchMood(mood, groupFilters, rng, cap);
    const results: DeckFilm[] = pool.films.map(
      (r) => ({
        id: r.id,
        title: r.title,
        poster_path: r.poster_path,
        release_date: r.release_date,
        vote_average: r.vote_average,
        overview: r.overview,
        genre_ids: r.genre_ids ?? [],
        mood_keys: [mood],
      }),
    );

    return { mood, count, results };
  });

  // Partial failure is survivable — the allocation below redistributes.
  const { values, firstRejection } = await settleTMDB(fetchResults);
  const moodResults = values.filter((v) => v !== undefined);

  // Build deck: pick films per mood allocation, dedup across moods.
  // If a film appears under multiple moods, merge the mood_keys.
  const seen = new Map<number, DeckFilm>();
  const deck: DeckFilm[] = [];

  for (const { mood, count, results } of moodResults) {
    let picked = 0;
    for (const film of results) {
      if (picked >= count) break;
      const existing = seen.get(film.id);
      if (existing) {
        if (!existing.mood_keys.includes(mood)) {
          existing.mood_keys.push(mood);
        }
        continue;
      }
      const deckFilm: DeckFilm = {
        id: film.id,
        title: film.title,
        poster_path: film.poster_path,
        release_date: film.release_date,
        vote_average: film.vote_average,
        overview: film.overview,
        genre_ids: film.genre_ids,
        mood_keys: [mood],
      };
      seen.set(film.id, deckFilm);
      deck.push(deckFilm);
      picked++;
    }
  }

  // If any mood couldn't fill its allocation, backfill from others
  if (deck.length < DECK_SIZE) {
    for (const { mood, results } of moodResults) {
      for (const film of results) {
        if (deck.length >= DECK_SIZE) break;
        if (seen.has(film.id)) continue;
        const deckFilm: DeckFilm = {
          id: film.id,
          title: film.title,
          poster_path: film.poster_path,
          release_date: film.release_date,
          vote_average: film.vote_average,
          overview: film.overview,
          genre_ids: film.genre_ids,
          mood_keys: [mood],
        };
        seen.set(film.id, deckFilm);
        deck.push(deckFilm);
      }
    }
  }

  // A thin deck with nothing rejected can be the services' fault, so it gets one more build on Norway.
  if (deck.length < MIN_DECK_SIZE && providers.length > 0 && !firstRejection) return buildSharedDeck(participants);

  // Size is the guard, not rejections: an over-constrained query answers 200 with few films, and a stored deck is final.
  // With a rejection the cause is TMDB, worth a retry; without one it's the picks, which the last submitter has to change.
  if (deck.length < MIN_DECK_SIZE) throw firstRejection ?? new DeckTooThinError(deck.length);

  return deck;
}
