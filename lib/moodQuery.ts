// Mood → TMDB discover params. Pure: no env reads, no fetch.

import { moodMap } from "@/lib/moodMap";
import type { MoodConfig } from "@/lib/types";

/** Shorts and TV specials never belong in a mood result. */
export const RUNTIME_FLOOR = 60;

/**
 * How far a mood's own query is loosened. 1 drops the non-essential side
 * (keywords or genres), 2 also eases the vote floors. Exclusions, the runtime
 * floor and a certification cap hold at every tier.
 */
export type Tier = 0 | 1 | 2;

/** TMDB params for a mood's certification cap; none when it has no cap. */
export function certificationParams(cap: MoodConfig["certification"]): Record<string, string> {
  if (!cap) return {};
  return {
    certification_country: cap.country,
    // TMDB ranks US "NR" below G, so an upper bound alone lets unrated films through.
    "certification.gte": "G",
    "certification.lte": cap.lte,
  };
}

export function paramsForConfig(mood: MoodConfig, tier: Tier = 0): Record<string, string> {
  const eased = tier === 2;
  const voteCountGte = eased ? Math.max(1, Math.round(mood.voteCountGte * 0.5)) : mood.voteCountGte;
  const voteAverageGte =
    eased && mood.voteAverageGte ? Math.max(0, mood.voteAverageGte - 0.5) : mood.voteAverageGte;
  const genres = tier > 0 && mood.essential === "keywords" ? [] : mood.genres;
  const keywords = tier > 0 && mood.essential === "genres" ? [] : mood.keywords;

  const params: Record<string, string> = {
    sort_by: mood.sortBy,
    "vote_count.gte": String(voteCountGte),
    "with_runtime.gte": String(RUNTIME_FLOOR),
  };
  // TMDB: "," = AND, "|" = OR — `npm run check:moods -- --probe` verifies it.
  if (genres.length) {
    params.with_genres = genres.join(mood.genreMatch === "all" ? "," : "|");
  }
  if (mood.excludeGenres?.length) params.without_genres = mood.excludeGenres.join(",");
  if (voteAverageGte) params["vote_average.gte"] = String(voteAverageGte);
  if (keywords?.length) params.with_keywords = keywords.join("|");
  return { ...params, ...certificationParams(mood.certification) };
}

function moodFor(key: string): MoodConfig {
  // hasOwn, not `in` or a bare lookup: both also find Object.prototype keys.
  if (!Object.hasOwn(moodMap, key)) throw new Error(`Unknown mood: ${key}`);
  return moodMap[key];
}

export function buildMoodParams(moodKey: string, tier: Tier = 0): Record<string, string> {
  return paramsForConfig(moodFor(moodKey), tier);
}
