// Mood data — genres, sort and filters per mood. lib/moodQuery.ts turns it into TMDB params.
// TMDB Genre IDs: 28=Action, 12=Adventure, 16=Animation, 35=Comedy, 80=Crime,
// 18=Drama, 10751=Family, 14=Fantasy, 36=History, 27=Horror, 9648=Mystery,
// 10749=Romance, 878=Sci-Fi, 53=Thriller, 10752=War, 37=Western
// Keyword IDs live in lib/tmdbKeywords.ts, by name.

import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";
import type { MoodConfig } from "@/lib/types";
export const moodMap: Record<string, MoodConfig> = {
  laugh: {
    key: "laugh",
    tagLabel: "Need to laugh",
    label: "Laugh until it hurts",
    description: "Big laughs, zero homework",
    accentColor: "gold",
    genres: [35],
    // Animation lives in `family`.
    excludeGenres: [27, 16],
    essential: "genres",
    relatedMoods: ["easy", "datenight", "family"],
    sortBy: "popularity.desc",
    voteCountGte: 500,
    signatureFilm: { tmdbId: 346698, title: "Barbie", year: 2023, posterPath: "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg" },
  },
  easy: {
    key: "easy",
    tagLabel: "Need a hug",
    label: "Warm & familiar",
    description: "Warm, gentle, comforting",
    accentColor: "teal",
    genres: [35, 18, 10749],
    // Western, animation and family pulled in Django and Toy Story via `friendship`.
    excludeGenres: [27, 53, 80, 10752, 37, 16, 10751],
    // feelgood + heartwarming alone tag too few films to fill the mood (5 on NO flatrate).
    keywords: [TMDB_KEYWORDS.feelGood.id, TMDB_KEYWORDS.heartwarming.id, TMDB_KEYWORDS.friendship.id],
    essential: "keywords",
    relatedMoods: ["laugh", "family", "nostalgic"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 7.0,
    signatureFilm: { tmdbId: 840430, title: "The Holdovers", year: 2023, posterPath: "/VHSzNBTwxV8vh7wylo7O9CLdac.jpg" },
  },
  family: {
    key: "family",
    tagLabel: "Everyone's watching",
    label: "Watch with family",
    description: "Works for kids and grown-ups",
    accentColor: "teal",
    genres: [10751],
    essential: "genres",
    relatedMoods: ["easy", "laugh", "escape"],
    certification: { country: "US", lte: "PG" },
    sortBy: "popularity.desc",
    voteCountGte: 300,
    signatureFilm: { tmdbId: 1184918, title: "The Wild Robot", year: 2024, posterPath: "/wTnV3PCVW5O92JMrFvvrRcV39RU.jpg" },
  },
  datenight: {
    key: "datenight",
    tagLabel: "Date night",
    label: "Easy-watch together",
    description: "Romance with a light touch",
    accentColor: "rose",
    genres: [10749],
    excludeGenres: [27, 10752],
    keywords: [TMDB_KEYWORDS.romanticComedy.id],
    essential: "genres",
    relatedMoods: ["laugh", "easy", "cry"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    signatureFilm: { tmdbId: 1072790, title: "Anyone But You", year: 2023, posterPath: "/5qHoazZiaLe7oFBok7XlUhg96f2.jpg" },
  },
  cry: {
    key: "cry",
    tagLabel: "Need to let it out",
    label: "A good cry",
    description: "Moving, cathartic, beautiful",
    accentColor: "blue",
    genres: [18],
    // Crime let grief-tagged gangster films (The Godfather) lead the list, and
    // animation (both Lion Kings) lives in `family`.
    excludeGenres: [35, 28, 27, 80, 16],
    keywords: [TMDB_KEYWORDS.tearjerker.id, TMDB_KEYWORDS.grief.id, TMDB_KEYWORDS.lossOfLovedOne.id],
    essential: "genres",
    relatedMoods: ["nostalgic", "inspiring", "datenight"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 7.0,
    signatureFilm: { tmdbId: 994108, title: "All of Us Strangers", year: 2023, posterPath: "/aviJMFZSnnCAsCVyJGaPNx4Ef3i.jpg" },
  },
  nostalgic: {
    key: "nostalgic",
    tagLabel: "Take me back",
    label: "Wistful & nostalgic",
    description: "Coming-of-age, tender memories",
    accentColor: "rose",
    genres: [],
    // Without these the childhood keywords are led by Harry Potter and Pixar.
    excludeGenres: [16, 10751, 28, 14],
    keywords: [TMDB_KEYWORDS.comingOfAge.id, TMDB_KEYWORDS.nostalgic.id, TMDB_KEYWORDS.childhood.id],
    essential: "keywords",
    relatedMoods: ["cry", "easy", "inspiring"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 7.0,
    signatureFilm: { tmdbId: 391713, title: "Lady Bird", year: 2017, posterPath: "/gl66K7zRdtNYGrxyS2YDUP5ASZd.jpg" },
  },
  inspiring: {
    key: "inspiring",
    tagLabel: "Want to dream",
    label: "Something inspiring",
    description: "Stories that lift you up",
    accentColor: "gold",
    genres: [18, 36],
    keywords: [TMDB_KEYWORDS.basedOnTrueStory.id, TMDB_KEYWORDS.underdog.id, TMDB_KEYWORDS.biography.id],
    essential: "keywords",
    relatedMoods: ["cry", "nostalgic", "escape"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 7.2,
    signatureFilm: { tmdbId: 872585, title: "Oppenheimer", year: 2023, posterPath: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
  },
  thrilling: {
    key: "thrilling",
    tagLabel: "Need a rush",
    label: "Pure adrenaline",
    description: "Non-stop, high octane",
    accentColor: "ember",
    genres: [28],
    excludeGenres: [35, 16],
    essential: "genres",
    relatedMoods: ["dark", "unsettled", "escape"],
    sortBy: "popularity.desc",
    voteCountGte: 500,
    signatureFilm: { tmdbId: 575264, title: "Mission: Impossible - Dead Reckoning Part One", year: 2023, posterPath: "/NNxYkU70HPurnNCSiCjYAmacwm.jpg" },
  },
  unsettled: {
    key: "unsettled",
    tagLabel: "Feel uneasy",
    label: "Slow-burn tension",
    description: "Slow tension under the skin",
    accentColor: "violet",
    genres: [53, 27, 9648],
    keywords: [TMDB_KEYWORDS.psychologicalThriller.id, TMDB_KEYWORDS.paranoia.id],
    essential: "genres",
    relatedMoods: ["dark", "mindbending", "thrilling"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 6.5,
    signatureFilm: { tmdbId: 467244, title: "The Zone of Interest", year: 2023, posterPath: "/hUu9zyZmDd8VZegKi1iK1Vk0RYS.jpg" },
  },
  dark: {
    key: "dark",
    tagLabel: "Go dark",
    label: "Cold, gritty, bleak",
    description: "Crime, noir, moral grey",
    accentColor: "ember",
    genres: [80],
    excludeGenres: [16, 10751, 35],
    keywords: [TMDB_KEYWORDS.neoNoir.id, TMDB_KEYWORDS.revenge.id, TMDB_KEYWORDS.corruption.id],
    essential: "genres",
    relatedMoods: ["unsettled", "thrilling", "mindbending"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 6.8,
    signatureFilm: { tmdbId: 800158, title: "The Killer", year: 2023, posterPath: "/ipkcgvN7h3yZnbYowthloHLKsf4.jpg" },
  },
  mindbending: {
    key: "mindbending",
    tagLabel: "Bend my mind",
    label: "Reality-shifting puzzles",
    description: "Twists, puzzles, the surreal",
    accentColor: "violet",
    genres: [878, 9648, 53, 14],
    keywords: [
      TMDB_KEYWORDS.timeTravel.id,
      TMDB_KEYWORDS.twistEnding.id,
      TMDB_KEYWORDS.nonlinearTimeline.id,
      TMDB_KEYWORDS.surreal.id,
      TMDB_KEYWORDS.dystopia.id,
    ],
    essential: "keywords",
    relatedMoods: ["unsettled", "escape", "dark"],
    sortBy: "popularity.desc",
    voteCountGte: 300,
    voteAverageGte: 7.0,
    signatureFilm: { tmdbId: 545611, title: "Everything Everywhere All at Once", year: 2022, posterPath: "/u68AjlvlutfEIcpmbYpKcdi09ut.jpg" },
  },
  escape: {
    key: "escape",
    tagLabel: "Want to disappear",
    label: "Sweeping visuals await",
    description: "Other worlds, sweeping scale",
    accentColor: "blue",
    genres: [14, 12, 878],
    // Family adventures (Toy Story) belong to `family`.
    excludeGenres: [27, 10751],
    essential: "genres",
    relatedMoods: ["mindbending", "family", "thrilling"],
    sortBy: "popularity.desc",
    voteCountGte: 500,
    voteAverageGte: 7.0,
    signatureFilm: { tmdbId: 792307, title: "Poor Things", year: 2023, posterPath: "/kCGlIMHnOm8JPXq3rXM6c5wMxcT.jpg" },
  },
};

// All moods as an array for UI iteration
export const allMoods = Object.values(moodMap);

/** A search blends at most two moods, and the pickers stop at the same number. */
export const MAX_MOODS = 2;

/** Retired mood keys → the mood that absorbed them. Old history rows and shared links still carry them. */
export const LEGACY_MOOD_ALIASES: Record<string, string> = {
  beautiful: "cry",
  thoughtful: "mindbending",
  weird: "mindbending",
};

/** Canonical key for a current or retired mood key; null if unknown. */
export function normalizeMoodKey(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  // hasOwn, not `in`: both maps would otherwise answer for "constructor" etc.
  if (Object.hasOwn(moodMap, key)) return key;
  if (!Object.hasOwn(LEGACY_MOOD_ALIASES, key)) return null;
  const alias = LEGACY_MOOD_ALIASES[key];
  return Object.hasOwn(moodMap, alias) ? alias : null;
}

/** Normalise, drop unknowns, dedupe — order preserved. */
export function normalizeMoodKeys(raw: string[]): string[] {
  const keys = raw.map(normalizeMoodKey).filter((k): k is string => k !== null);
  return [...new Set(keys)];
}
