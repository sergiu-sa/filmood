import { NextRequest, NextResponse } from "next/server";
import { buildTMDBParams, buildMergedTMDBParams, moodMap } from "@/lib/moodMap";
import { resolveMoodText } from "@/lib/moodResolver";
import {
  applyEra,
  applyTempo,
  appendExtraKeywords,
  isEraKey,
  isTempoKey,
} from "@/lib/moodRefinements";
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

// Shared helper: build a TMDB discover URL from param object + refinements.
// Page is set by fetchDiscoverPage so the same base URL can be reused.
function buildDiscoverURL(
  apiKey: string,
  moodParams: Record<string, string>,
  refinements: Refinements,
): URL {
  const url = new URL("https://api.themoviedb.org/3/discover/movie");
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("language", "en-US");

  for (const [k, v] of Object.entries(moodParams)) {
    url.searchParams.set(k, v);
  }

  if (refinements.runtime === "short") {
    url.searchParams.set("with_runtime.lte", "100");
  } else if (refinements.runtime === "long") {
    url.searchParams.set("with_runtime.gte", "150");
  }

  if (refinements.language === "en") {
    url.searchParams.set("with_original_language", "en");
  } else if (refinements.language === "scand") {
    url.searchParams.set("with_original_language", "en|no|sv|da|fi|is");
  }

  if (refinements.exclude) {
    const existing = url.searchParams.get("without_genres");
    const merged = existing ? `${existing},${refinements.exclude}` : refinements.exclude;
    url.searchParams.set("without_genres", merged);
  }

  // Tempo overrides runtime when both are set (more intentional axis).
  applyTempo(url, refinements.tempo);
  applyEra(url, refinements.era);
  appendExtraKeywords(url, refinements.extraKeywords);

  return url;
}

// Fetch a specific TMDB discover page. Returns [] on any network/HTTP error so
// one bad page doesn't blow up the whole search.
async function fetchDiscoverPage(
  baseURL: URL,
  page: number,
): Promise<{ id: number }[]> {
  const paged = new URL(baseURL.toString());
  paged.searchParams.set("page", String(page));
  try {
    const res = await fetch(paged.toString());
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as { id: number }[];
  } catch {
    return [];
  }
}

// Fetch page 1 + one random page from [2..MAX_PAGE] and return the merged,
// deduped pool. Pooling widens the candidate set so a Fisher-Yates shuffle
// produces genuine variety across repeat searches, while page 1 keeps
// quality anchored.
async function fetchDiscoverPool(baseURL: URL): Promise<{ id: number }[]> {
  const secondPage = 2 + Math.floor(Math.random() * (MAX_PAGE - 1));
  const [first, second] = await Promise.all([
    fetchDiscoverPage(baseURL, 1),
    fetchDiscoverPage(baseURL, secondPage),
  ]);
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

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 }
    );
  }

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

  // Optional refinement params
  const eraParam = searchParams.get("era");
  const tempoParam = searchParams.get("tempo");
  const refinements: Refinements = {
    runtime: searchParams.get("runtime"),
    language: searchParams.get("language"),
    exclude: searchParams.get("exclude"),
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
    const mergedURL = buildDiscoverURL(apiKey, mergedParams, refinements);

    // Fetch pages 1 + random(2..MAX_PAGE) and shuffle so repeat searches
    // return different films instead of the same top 20.
    let films: { id: number }[] = shuffle(await fetchDiscoverPool(mergedURL));

    // ── Fallback: if the merged pool returned < 5 films and we have
    //    multiple moods, supplement with per-mood pools so the page
    //    never feels empty. The blended results stay at the top. ──
    if (films.length < 5 && moodKeys.length > 1) {
      const seen = new Set(films.map((f) => f.id));

      const fallbackPools = await Promise.all(
        moodKeys.map((key) => {
          const url = buildDiscoverURL(apiKey, buildTMDBParams(key), refinements);
          return fetchDiscoverPool(url);
        }),
      );
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
    const message =
      error instanceof Error ? error.message : "Failed to fetch films";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
