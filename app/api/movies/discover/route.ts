import { NextRequest, NextResponse } from "next/server";
import { buildTMDBParams, buildMergedTMDBParams, moodMap } from "@/lib/moodMap";
import { resolveMoodText } from "@/lib/moodResolver";
import {
  applyEra,
  applyTempo,
  mergeExtraKeywords,
  isEraKey,
  isTempoKey,
} from "@/lib/moodRefinements";
import { tmdbError } from "@/lib/api-errors";
import { tmdbJson, TMDBError, settleTMDB } from "@/lib/tmdb-fetch";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { recordMoodPicks } from "@/lib/mood-history";
import type { EraKey, TempoKey } from "@/lib/types";

interface Refinements {
  runtime: string | null;
  language: string | null;
  exclude: string | null;
  era: EraKey | null;
  tempo: TempoKey | null;
  extraKeywords: number[];
}

// How many TMDB result pages to pool per search. Page 1 is always fetched
// (quality anchor); one more page is picked from [2..MAX_PAGE] to widen the
// pool and vary results across repeat searches.
const MAX_PAGE = 3;
// Final deck size returned to the client.
const RESULT_LIMIT = 20;

// Shared helper: build a TMDB discover query from param object + refinements.
// Page is set by fetchDiscoverPage so the same base query can be reused.
function buildDiscoverParams(
  moodParams: Record<string, string>,
  refinements: Refinements,
): Record<string, string> {
  const params: Record<string, string> = { language: "en-US", ...moodParams };

  if (refinements.runtime === "short") {
    params["with_runtime.lte"] = "100";
  } else if (refinements.runtime === "long") {
    params["with_runtime.gte"] = "150";
  }

  if (refinements.language === "en") {
    params["with_original_language"] = "en";
  } else if (refinements.language === "scand") {
    params["with_original_language"] = "en|no|sv|da|fi|is";
  }

  if (refinements.exclude) {
    const existing = params["without_genres"];
    params["without_genres"] = existing
      ? `${existing},${refinements.exclude}`
      : refinements.exclude;
  }

  // Tempo overrides runtime when both are set (more intentional axis).
  applyTempo(params, refinements.tempo);
  applyEra(params, refinements.era);
  mergeExtraKeywords(params, refinements.extraKeywords);

  return params;
}

// Fetch a specific TMDB discover page. A 404 yields []; anything worse rejects
// so the caller decides whether that page was optional.
async function fetchDiscoverPage(
  baseParams: Record<string, string>,
  page: number,
): Promise<{ id: number }[]> {
  try {
    const data = await tmdbJson<{ results?: { id: number }[] }>(
      "/discover/movie",
      { ...baseParams, page: String(page) },
      // Uncached: every mood combination is a distinct query.
      false,
    );
    return data.results ?? [];
  } catch (error) {
    // One page genuinely missing shouldn't sink the search. Anything else —
    // a missing key, a rotated key, a rate limit — must reach the handler's
    // catch, or a broken deploy renders as "no films match your mood".
    if (error instanceof TMDBError && error.status === 404) return [];
    throw error;
  }
}

// Fetch page 1 + one random page from [2..MAX_PAGE] and return the merged,
// deduped pool. Pooling widens the candidate set so a Fisher-Yates shuffle
// produces genuine variety across repeat searches, while page 1 keeps
// quality anchored.
async function fetchDiscoverPool(
  baseParams: Record<string, string>,
): Promise<{ id: number }[]> {
  const secondPage = 2 + Math.floor(Math.random() * (MAX_PAGE - 1));
  // Page 1 is the result; the random page only widens variety. Doubling the
  // request rate is also what provokes a rate limiter, so losing the optional
  // page must not throw away the page we actually need.
  const [firstResult, secondResult] = await Promise.allSettled([
    fetchDiscoverPage(baseParams, 1),
    fetchDiscoverPage(baseParams, secondPage),
  ]);
  if (firstResult.status === "rejected") throw firstResult.reason;
  const first = firstResult.value;
  const second = secondResult.status === "fulfilled" ? secondResult.value : [];
  const seen = new Set<number>();
  const pool: { id: number }[] = [];
  for (const film of [...first, ...second]) {
    if (seen.has(film.id)) continue;
    seen.add(film.id);
    pool.push(film);
  }
  return pool;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const moodParam = searchParams.get("mood");
  const text = searchParams.get("text");

  // Resolve the optional free-form text into mood keys + keywords + era/tempo.
  // Explicit chip values for era/tempo win over anything inferred from text.
  const resolved = text && text.trim() ? resolveMoodText(text.trim()) : null;

  const tileKeys = (moodParam ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k && k in moodMap);
  const textKeys = resolved?.moodKeys ?? [];
  const moodKeys = [...new Set([...tileKeys, ...textKeys])];

  if (moodKeys.length === 0) {
    // Resolver picked up era/tempo/keywords but no mood word — we need at least
    // one mood signal to build a genre query, so nudge the user toward one.
    const partialMatch =
      resolved !== null &&
      (resolved.era !== null ||
        resolved.tempo !== null ||
        resolved.keywords.length > 0);
    return NextResponse.json(
      {
        error: partialMatch
          ? "Add a feeling word — like 'funny', 'dark', or 'cozy'. Era or tempo alone isn't enough."
          : "Provide a mood tile or describe your mood",
      },
      { status: 400 }
    );
  }

  // Record mood picks for signed-in users. Fire-and-forget — Vercel's
  // serverless runtime waits for pending promises before the function
  // exits, so the insert is reliable even though we don't await it here.
  const user = await getAuthUser(request);
  if (user) {
    recordMoodPicks(getSupabaseAdmin(), user.id, moodKeys).catch((err) =>
      console.error("mood_history insert failed", err),
    );
  }

  // Optional refinement params
  const eraParam = searchParams.get("era");
  const tempoParam = searchParams.get("tempo");
  const refinements: Refinements = {
    runtime: searchParams.get("runtime"),
    language: searchParams.get("language"),
    // TMDB's without_genres takes a comma-separated id list; anything else
    // earns a 400 upstream, which would reach tmdbError and surface as our
    // 500 for what is purely client input.
    exclude: /^\d+(,\d+)*$/.test(searchParams.get("exclude") ?? "")
      ? searchParams.get("exclude")
      : null,
    era: isEraKey(eraParam) ? eraParam : resolved?.era ?? null,
    tempo: isTempoKey(tempoParam) ? tempoParam : resolved?.tempo ?? null,
    extraKeywords: resolved?.keywords ?? [],
  };

  try {
    // ── Primary: merged mood query ──
    // For a single mood this behaves identically to the old per-mood fetch.
    // For multiple moods it builds a single TMDB query that targets the
    // genre intersection (or cross-genre AND), so results genuinely match
    // the *combination* of moods rather than being a shuffled concat.
    const mergedParams = buildMergedTMDBParams(moodKeys);
    const mergedQuery = buildDiscoverParams(mergedParams, refinements);

    // Fetch pages 1 + random(2..MAX_PAGE) and shuffle so repeat searches
    // return different films instead of the same top 20.
    let films: { id: number }[] = shuffle(await fetchDiscoverPool(mergedQuery));

    // ── Fallback: if the merged pool returned < 5 films and we have
    //    multiple moods, supplement with per-mood pools so the page
    //    never feels empty. The blended results stay at the top. ──
    if (films.length < 5 && moodKeys.length > 1) {
      const seen = new Set(films.map((f) => f.id));

      // Supplementary pools only top up an already-thin result, so one
      // failing mood must not discard the films we already have.
      const { values: fallbackPools, firstRejection } = await settleTMDB(
        moodKeys.map((key) => {
          const query = buildDiscoverParams(buildTMDBParams(key), refinements);
          return fetchDiscoverPool(query);
        }),
      );

      // Nothing anywhere plus a real failure is an outage, not "no matches".
      if (films.length === 0 && fallbackPools.every((p) => p.length === 0) && firstRejection) {
        throw firstRejection;
      }
      const extras = shuffle(fallbackPools.flat()).filter((f) => {
        if (seen.has(f.id)) return false;
        seen.add(f.id);
        return true;
      });

      // Merged (blended) results first, then individual mood results
      films = [...films, ...extras];
    }

    films = films.slice(0, RESULT_LIMIT);

    const labels = moodKeys.map((k) => moodMap[k].label);

    return NextResponse.json({
      mood: moodKeys.join(","),
      moods: labels,
      films,
      total: films.length,
      resolved: resolved
        ? {
            matched: resolved.matched,
            addedMoods: textKeys,
            era: resolved.era,
            tempo: resolved.tempo,
          }
        : null,
    });
  } catch (error) {
    return tmdbError(error, "Failed to fetch films");
  }
}
