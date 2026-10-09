// The mood → films engine behind /api/movies/discover and lib/deck.ts.
// Server-only: it calls TMDB through lib/tmdb-fetch.
//
// Each mood is searched on its own, loosening only its own constraints until
// TMDB has enough films. The user's filters and a certification cap are never
// loosened. Two moods blend as separate pools, shared films first.

import { moodMap } from "@/lib/moodMap";
import { buildMoodParams, certificationParams, type Tier } from "@/lib/moodQuery";
import { applyFilters, withoutFilter, type FilterKey, type Filters } from "@/lib/moodFilters";
import { mulberry32, SEED_MAX } from "@/lib/seededRandom";
import { settleTMDB, tmdbJson, TMDBError } from "@/lib/tmdb-fetch";
import type { MoodConfig } from "@/lib/types";

export const MIN_RESULTS = 12;
export const RESULT_LIMIT = 20;
const MAX_EXTRA_PAGE = 5;
/**
 * Mood discover calls cache for an hour, unlike free-text search: moods ×
 * tiers × filter values is a finite space, so repeats are cache hits.
 */
export const MOOD_DISCOVER_REVALIDATE = 3600;

type CertificationCap = MoodConfig["certification"];

export interface TMDBDiscoverRaw {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count?: number;
  overview: string;
  genre_ids?: number[];
}

export interface MoodPool {
  moodKey: string;
  tier: Tier;
  total: number;
  films: TMDBDiscoverRaw[];
}

export interface MoodSearchResult {
  films: (TMDBDiscoverRaw & { moodKeys: string[] })[];
  relaxed: Tier;
  partial: boolean;
  suggestions: { remove: FilterKey; total: number }[];
  relatedMoods: string[];
}

interface DiscoverPage {
  results: TMDBDiscoverRaw[];
  total: number;
  totalPages: number;
}

/** The exact TMDB query for one mood at one tier: the mood, a search-wide cap, then the user's filters. */
export function buildSearchParams(
  moodKey: string,
  f: Filters,
  tier: Tier,
  cap?: CertificationCap,
): Record<string, string> {
  const params: Record<string, string> = {
    language: "en-US",
    ...buildMoodParams(moodKey, tier),
    ...certificationParams(cap),
  };
  // Text keywords sharpen a mood the way its own keywords do, so they go when those do.
  const keepsKeywords = tier === 0 || moodMap[moodKey].essential === "keywords";
  applyFilters(params, keepsKeywords ? f : { ...f, extraKeywords: [] });
  return params;
}

async function fetchPage(params: Record<string, string>, page: number): Promise<DiscoverPage> {
  try {
    const data = await tmdbJson<{
      results?: TMDBDiscoverRaw[];
      total_results?: number;
      total_pages?: number;
    }>("/discover/movie", { ...params, page: String(page) }, MOOD_DISCOVER_REVALIDATE);
    const results = data.results ?? [];
    return {
      results,
      total: data.total_results ?? results.length,
      totalPages: data.total_pages ?? 1,
    };
  } catch (error) {
    // A missing page is "no films". A bad key, a rate limit or an outage must
    // reach the route's catch, or a broken deploy renders as an empty mood.
    if (error instanceof TMDBError && error.status === 404) {
      return { results: [], total: 0, totalPages: 0 };
    }
    throw error;
  }
}

function dedupeById<T extends { id: number }>(films: T[]): T[] {
  const seen = new Set<number>();
  return films.filter((f) => !seen.has(f.id) && seen.add(f.id));
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One mood: climb tiers until page 1 reports ≥ MIN_RESULTS, then widen with one extra page. */
export async function searchMood(
  moodKey: string,
  f: Filters,
  rng: () => number,
  cap?: CertificationCap,
): Promise<MoodPool> {
  let params = buildSearchParams(moodKey, f, 0, cap);
  let best = { tier: 0 as Tier, params, page: await fetchPage(params, 1) };

  for (const tier of [1, 2] as const) {
    if (best.page.total >= MIN_RESULTS) break;
    const next = buildSearchParams(moodKey, f, tier, cap);
    // A mood with nothing to drop at tier 1 would repeat tier 0's call.
    if (JSON.stringify(next) === JSON.stringify(params)) continue;
    params = next;
    const page = await fetchPage(next, 1);
    if (page.total > best.page.total) best = { tier, params: next, page };
  }

  let films = best.page.results;
  const lastPage = Math.min(best.page.totalPages, MAX_EXTRA_PAGE);
  if (lastPage >= 2) {
    const extra = 2 + Math.floor(rng() * (lastPage - 1));
    // Page 1 is the result; the extra page only widens it, so losing it costs nothing.
    const more = await fetchPage(best.params, extra).catch(() => null);
    if (more) films = dedupeById([...films, ...more.results]);
  }

  return { moodKey, tier: best.tier, total: best.page.total, films };
}

function blend(pools: MoodPool[], rng: () => number): MoodSearchResult["films"] {
  const tag = (keys: string[]) => (f: TMDBDiscoverRaw) => ({ ...f, moodKeys: keys });
  const [a, b] = pools;
  if (!a) return [];
  if (!b) return shuffle(a.films, rng).map(tag([a.moodKey])).slice(0, RESULT_LIMIT);

  const inA = new Set(a.films.map((f) => f.id));
  const inB = new Set(b.films.map((f) => f.id));
  const both = shuffle(a.films.filter((f) => inB.has(f.id)), rng).map(tag([a.moodKey, b.moodKey]));
  const onlyA = shuffle(a.films.filter((f) => !inB.has(f.id)), rng).map(tag([a.moodKey]));
  const onlyB = shuffle(b.films.filter((f) => !inA.has(f.id)), rng).map(tag([b.moodKey]));

  const alternated = [];
  for (let i = 0; i < Math.max(onlyA.length, onlyB.length); i++) {
    if (i < onlyA.length) alternated.push(onlyA[i]);
    if (i < onlyB.length) alternated.push(onlyB[i]);
  }
  return [...both, ...alternated].slice(0, RESULT_LIMIT);
}

/** For each removable filter, how many films the settled pools would have without it. */
async function suggestRemovals(
  pools: MoodPool[],
  f: Filters,
  removable: FilterKey[],
  cap: CertificationCap,
  count: number,
): Promise<MoodSearchResult["suggestions"]> {
  const probes = await Promise.all(
    removable.map(async (remove) => {
      // Suggestions are optional, so a failed probe just counts nothing.
      const { values } = await settleTMDB(
        pools.map((p) =>
          fetchPage(buildSearchParams(p.moodKey, withoutFilter(f, remove), p.tier, cap), 1),
        ),
        () => false,
      );
      return { remove, total: values.reduce((sum, v) => sum + (v?.total ?? 0), 0) };
    }),
  );
  return probes
    .filter((s) => s.total > count)
    .sort((x, y) => y.total - x.total);
}

/** Picking "Everyone's watching" means kids are watching, so its cap covers every pool. */
export function searchCap(moodKeys: string[]): CertificationCap {
  return moodKeys.map((k) => moodMap[k].certification).find(Boolean);
}

/**
 * 1–2 moods → blended, capped result, plus suggestions when it's thin.
 * `removable` lists the filters a suggestion may offer to loosen (see `removableFilterKeys`).
 */
export async function runMoodSearch(
  moodKeys: string[],
  f: Filters,
  rng: () => number,
  removable: FilterKey[],
): Promise<MoodSearchResult> {
  const cap = searchCap(moodKeys);
  // One generator per pool, drawn up front: the pools run in parallel, and a
  // shared one would make the order depend on which TMDB call returned first.
  const poolRngs = moodKeys.map(() => mulberry32(1 + Math.floor(rng() * SEED_MAX)));

  // Nothing to show plus a real failure is an outage, not "no matches". Read
  // off the pools, not `blend`, which would draw from `rng` a second time.
  const { values, failure } = await settleTMDB(
    moodKeys.map((key, i) => searchMood(key, f, poolRngs[i], cap)),
    (settled) => settled.every((p) => !p?.films.length),
  );
  const pools = values.filter((p): p is MoodPool => p !== undefined);
  const films = blend(pools, rng);

  const thin = films.length < MIN_RESULTS && removable.length > 0;
  return {
    films,
    relaxed: Math.max(0, ...pools.map((p) => p.tier)) as Tier,
    partial: failure !== null,
    suggestions: thin ? await suggestRemovals(pools, f, removable, cap, films.length) : [],
    relatedMoods:
      films.length === 0
        ? moodMap[moodKeys[0]].relatedMoods.filter((k) => !moodKeys.includes(k))
        : [],
  };
}
