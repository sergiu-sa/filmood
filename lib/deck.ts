import { buildTMDBParams } from "@/lib/moodMap";
import {
  applyEra,
  applyTempo,
  appendExtraKeywords,
} from "@/lib/moodRefinements";
import type { DeckFilm, EraKey, TempoKey } from "@/lib/types";

const DECK_SIZE = 15;
// Cap how many text-derived keyword IDs we union across the group, to avoid
// over-constraining TMDB and producing empty results for large groups.
const MAX_SHARED_EXTRA_KEYWORDS = 3;

interface TMDBDiscoverResult {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
  genre_ids: number[];
}

interface ParticipantInput {
  mood_selections: string[] | null;
  era?: EraKey | null;
  tempo?: TempoKey | null;
  extra_keywords?: number[] | null;
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
 * and the mood(s) it was sourced from. Era, tempo, and text-derived keywords
 * are applied on top via majority vote (era/tempo) and capped union (keywords).
 */
export async function buildSharedDeck(
  participants: ParticipantInput[],
): Promise<DeckFilm[]> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB API key not configured");

  // Count mood frequency across all participants
  const moodCounts: Record<string, number> = {};
  for (const p of participants) {
    if (!p.mood_selections) continue;
    for (const mood of p.mood_selections) {
      moodCounts[mood] = (moodCounts[mood] || 0) + 1;
    }
  }

  const totalWeight = Object.values(moodCounts).reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return [];

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

  // Aggregate group refinements
  const sharedEra = majorityVote(participants.map((p) => p.era ?? null));
  const sharedTempo = majorityVote(participants.map((p) => p.tempo ?? null));
  const sharedKeywords = topKeywords(participants, MAX_SHARED_EXTRA_KEYWORDS);

  // Fetch TMDB results for each unique mood in parallel
  const fetchResults = allocations.map(async ({ mood, count }) => {
    const moodParams = buildTMDBParams(mood);
    const url = new URL("https://api.themoviedb.org/3/discover/movie");
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("language", "en-US");
    url.searchParams.set("page", "1");

    for (const [k, v] of Object.entries(moodParams)) {
      url.searchParams.set(k, v);
    }

    // Apply group-level refinements on top of the per-mood TMDB params.
    // Tempo goes before era so tempo's runtime filter sticks.
    applyTempo(url, sharedTempo);
    applyEra(url, sharedEra);
    appendExtraKeywords(url, sharedKeywords);

    const res = await fetch(url.toString());
    const data = await res.json();
    const results: DeckFilm[] = (data.results ?? []).map(
      (r: TMDBDiscoverResult) => ({
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

  const moodResults = await Promise.all(fetchResults);

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

  return deck;
}
