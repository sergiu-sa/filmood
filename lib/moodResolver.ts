// Resolves a free-form user description into structured mood signals.
// Pure: the discover route and the home describe field both run it. Deterministic,
// no network or LLM — a static synonym table matches unigrams and bigrams against
// mood keys, TMDB keyword IDs, era, and time.

import { moodMap } from "@/lib/moodMap";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";
import type { EraKey, TimeKey } from "@/lib/types";

/** Longest free text the search reads; the inputs' maxLength and the route's slice share it. */
export const MAX_TEXT_LENGTH = 120;

interface SynonymEntry {
  moods?: string[];
  keywords?: number[];
  era?: EraKey;
  time?: TimeKey;
}

// Keyed by lowercase unigram or bigram. Kept compact and curated — for long-tail
// phrases the UI falls back to a nudge to pick a tile.
export const SYNONYMS: Record<string, SynonymEntry> = {
  // Mood synonyms
  funny: { moods: ["laugh"] },
  hilarious: { moods: ["laugh"] },
  comedy: { moods: ["laugh"] },
  silly: { moods: ["laugh", "easy"] },

  cozy: { moods: ["easy"] },
  comfort: { moods: ["easy"] },
  "feel good": { moods: ["easy"], keywords: [TMDB_KEYWORDS.friendship.id] },
  wholesome: { moods: ["easy"] },

  romantic: { moods: ["datenight"] },
  date: { moods: ["datenight"] },
  "date night": { moods: ["datenight"] },
  "rom com": { moods: ["datenight"], keywords: [TMDB_KEYWORDS.romanticComedy.id] },
  romcom: { moods: ["datenight"], keywords: [TMDB_KEYWORDS.romanticComedy.id] },

  nostalgic: { moods: ["nostalgic"] },
  nostalgia: { moods: ["nostalgic"] },
  "coming of age": { moods: ["nostalgic"], keywords: [TMDB_KEYWORDS.comingOfAge.id] },
  tender: { moods: ["nostalgic", "cry"] },

  tearjerker: { moods: ["cry"] },
  sad: { moods: ["cry"] },
  cry: { moods: ["cry"] },
  emotional: { moods: ["cry"] },
  heartfelt: { moods: ["cry", "inspiring"] },

  scary: { moods: ["unsettled"] },
  horror: { moods: ["unsettled"] },
  creepy: { moods: ["unsettled"] },
  tense: { moods: ["unsettled", "thrilling"] },

  thriller: { moods: ["thrilling"] },
  action: { moods: ["thrilling"] },
  adrenaline: { moods: ["thrilling"] },
  intense: { moods: ["thrilling"] },
  heist: { moods: ["thrilling"], keywords: [TMDB_KEYWORDS.heist.id] },

  thoughtful: { moods: ["mindbending"] },
  cerebral: { moods: ["mindbending"] },
  smart: { moods: ["mindbending"] },

  "mind bending": { moods: ["mindbending"], keywords: [TMDB_KEYWORDS.mindBending.id] },
  mindbending: { moods: ["mindbending"], keywords: [TMDB_KEYWORDS.mindBending.id] },
  puzzle: { moods: ["mindbending"] },
  twist: { moods: ["mindbending"] },
  dystopia: { moods: ["mindbending"], keywords: [TMDB_KEYWORDS.dystopia.id] },
  dystopian: { moods: ["mindbending"], keywords: [TMDB_KEYWORDS.dystopia.id] },

  weird: { moods: ["mindbending"] },
  surreal: { moods: ["mindbending"] },
  quirky: { moods: ["mindbending"] },
  strange: { moods: ["mindbending"] },
  cult: { moods: ["mindbending"], keywords: [TMDB_KEYWORDS.cultFilm.id] },

  dark: { moods: ["dark"] },
  gritty: { moods: ["dark"] },
  noir: { moods: ["dark"], keywords: [TMDB_KEYWORDS.neoNoir.id] },
  crime: { moods: ["dark"] },
  bleak: { moods: ["dark"] },

  family: { moods: ["family"] },
  kids: { moods: ["family"] },
  "for kids": { moods: ["family"] },

  inspiring: { moods: ["inspiring"] },
  uplifting: { moods: ["inspiring"] },
  motivational: { moods: ["inspiring"] },

  beautiful: { moods: ["cry"] },
  gorgeous: { moods: ["cry"] },
  visual: { moods: ["escape"] },

  escape: { moods: ["escape"] },
  epic: { moods: ["escape", "thrilling"] },
  fantasy: { moods: ["escape"] },
  "sci fi": { moods: ["escape", "mindbending"] },
  scifi: { moods: ["escape", "mindbending"] },
  space: { moods: ["escape"] },

  // Era
  classic: { era: "classic" },
  old: { era: "classic" },
  vintage: { era: "classic" },
  "70s": { era: "classic" },
  "80s": { era: "classic" },
  "90s": { era: "modern" },
  "2000s": { era: "modern" },
  modern: { era: "modern" },
  recent: { era: "fresh" },
  new: { era: "fresh" },
  fresh: { era: "fresh" },

  // Time
  slow: { time: "long" },
  slowburn: { time: "long" },
  "slow burn": { time: "long" },
  meditative: { time: "long", moods: ["mindbending"] },

  fast: { time: "short" },
  "fast paced": { time: "short" },
  quick: { time: "short" },
  snappy: { time: "short" },
};

// Filler words that carry no mood, so they never count as unmatched.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "with", "of", "for", "something",
  "movie", "film", "films", "i", "want", "me", "to", "in", "like", "feel",
]);

export interface ResolvedMoodText {
  moodKeys: string[];
  keywords: number[];
  era: EraKey | null;
  time: TimeKey | null;
  /** Meaningful words that matched nothing, so the echo can say what it couldn't read. */
  unmatched: string[];
  /** True if anything matched. Callers can show a "couldn't find a match" nudge otherwise. */
  matched: boolean;
}

export function resolveMoodText(text: string): ResolvedMoodText {
  const lower = text.toLowerCase();
  // Split on whitespace + basic punctuation, keep digits (for "80s", "90s")
  const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);

  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }

  const moodSet = new Set<string>();
  const kwSet = new Set<number>();
  let era: EraKey | null = null;
  let time: TimeKey | null = null;
  const matchedBigrams = new Set<number>();

  const consume = (key: string, bigramStart?: number): boolean => {
    // hasOwn: a plain lookup would find Object.prototype's "constructor".
    if (!Object.hasOwn(SYNONYMS, key)) return false;
    const entry = SYNONYMS[key];
    entry.moods?.forEach((m) => {
      if (m in moodMap) moodSet.add(m);
    });
    entry.keywords?.forEach((k) => kwSet.add(k));
    if (entry.era && !era) era = entry.era;
    if (entry.time && !time) time = entry.time;
    if (bigramStart !== undefined) {
      matchedBigrams.add(bigramStart);
      matchedBigrams.add(bigramStart + 1);
    }
    return true;
  };

  // Bigrams first so they can claim both tokens before unigram fallbacks.
  bigrams.forEach((bg, i) => consume(bg, i));
  const unmatched = new Set<string>();
  tokens.forEach((tk, i) => {
    if (matchedBigrams.has(i) || consume(tk) || STOPWORDS.has(tk)) return;
    unmatched.add(tk);
  });

  const moodKeys = [...moodSet];
  const keywords = [...kwSet];
  return {
    moodKeys,
    keywords,
    era,
    time,
    unmatched: [...unmatched],
    matched:
      moodKeys.length > 0 || keywords.length > 0 || era !== null || time !== null,
  };
}
