// Mood → TMDB discover params. Pure: no env reads, no fetch.

import { moodMap } from "@/lib/moodMap";
import type { MoodConfig } from "@/lib/types";

/** Shorts and TV specials never belong in a mood result. */
export const RUNTIME_FLOOR = 60;

export function paramsForConfig(mood: MoodConfig): Record<string, string> {
  const params: Record<string, string> = {
    // TMDB: "," = AND, "|" = OR — `npm run check:moods -- --probe` verifies it.
    with_genres: mood.genres.join(mood.genreMatch === "all" ? "," : "|"),
    sort_by: mood.sortBy,
    "vote_count.gte": String(mood.voteCountGte),
    "with_runtime.gte": String(RUNTIME_FLOOR),
    watch_region: "NO",
    with_watch_monetization_types: "flatrate",
  };
  if (mood.excludeGenres?.length) params.without_genres = mood.excludeGenres.join(",");
  if (mood.voteAverageGte) params["vote_average.gte"] = String(mood.voteAverageGte);
  if (mood.keywords?.length) params.with_keywords = mood.keywords.join("|");
  return params;
}

export function buildMoodParams(moodKey: string): Record<string, string> {
  const mood = moodMap[moodKey];
  if (!mood) throw new Error(`Unknown mood: ${moodKey}`);
  return paramsForConfig(mood);
}

/**
 * Merge several moods into one TMDB query: shared genres (or each mood's
 * primary genre), the strictest quality floors, and the union of exclusions
 * minus the target genres.
 *
 * @deprecated A merged query matches neither mood; it goes once moods are
 * searched as separate pools and blended. Don't add callers.
 */
export function buildMergedMoodParams(moodKeys: string[]): Record<string, string> {
  if (moodKeys.length === 1) return buildMoodParams(moodKeys[0]);

  const configs = moodKeys.map((k) => {
    const mood = moodMap[k];
    if (!mood) throw new Error(`Unknown mood: ${k}`);
    return mood;
  });

  const genreCounts = new Map<number, number>();
  for (const cfg of configs) {
    for (const g of cfg.genres) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const sharedGenres = [...genreCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([genre]) => genre);
  const targetGenres =
    sharedGenres.length > 0
      ? sharedGenres
      : [...new Set(configs.map((c) => c.genres[0]))];

  const voteCountGte = Math.max(...configs.map((c) => c.voteCountGte));
  const voteAverageGte = Math.max(...configs.map((c) => c.voteAverageGte ?? 0));

  const targetSet = new Set(targetGenres);
  const allExcludes = new Set<number>();
  for (const cfg of configs) {
    for (const g of cfg.excludeGenres ?? []) {
      if (!targetSet.has(g)) allExcludes.add(g);
    }
  }

  const params: Record<string, string> = {
    with_genres: targetGenres.join("|"),
    sort_by: "vote_average.desc",
    "vote_count.gte": String(voteCountGte),
    "with_runtime.gte": String(RUNTIME_FLOOR),
    watch_region: "NO",
    with_watch_monetization_types: "flatrate",
  };
  if (allExcludes.size > 0) params.without_genres = [...allExcludes].join(",");
  if (voteAverageGte > 0) params["vote_average.gte"] = String(voteAverageGte);

  const allKeywords = new Set(configs.flatMap((c) => c.keywords ?? []));
  if (allKeywords.size > 0) params.with_keywords = [...allKeywords].join("|");

  return params;
}
