import { NextRequest, NextResponse } from "next/server";
import { mapTMDBFilm } from "@/lib/tmdb";
import type { Film } from "@/lib/types";
import { tmdbJson } from "@/lib/tmdb-fetch";
import { tmdbError, badRequest } from "@/lib/api-errors";

type RawCredit = Parameters<typeof mapTMDBFilm>[0] & {
  popularity: number;
  job?: string;
};

// Search results are query-driven, so every TMDB call here stays uncached.
const UNCACHED = false;

// Search by film title using TMDB /search/movie
async function searchByTitle(query: string) {
  const data = await tmdbJson<{ results?: RawCredit[] }>(
    "/search/movie",
    { language: "en-US", query, page: "1", include_adult: "false" },
    UNCACHED,
  );
  return (data.results ?? []).slice(0, 20).map(mapTMDBFilm);
}

function topByPopularity(credits: RawCredit[]) {
  return [...credits]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 20)
    .map(mapTMDBFilm);
}

/**
 * Look the person up once and return both role slices. `type=all` needs acting
 * and directing credits from the same payload — asking per role would repeat
 * the person lookup and the credits fetch for an identical query, which the
 * uncached search path cannot absorb.
 */
async function searchPersonCredits(query: string) {
  const personData = await tmdbJson<{ results?: { id: number }[] }>(
    "/search/person",
    { language: "en-US", query, page: "1", include_adult: "false" },
    UNCACHED,
  );

  const person = personData.results?.[0];
  if (!person) return { actor: [], director: [] };

  const credits = await tmdbJson<{ cast?: RawCredit[]; crew?: RawCredit[] }>(
    `/person/${person.id}/movie_credits`,
    { language: "en-US" },
    UNCACHED,
  );

  return {
    actor: topByPopularity(credits.cast ?? []),
    director: topByPopularity(
      (credits.crew ?? []).filter((c) => c.job === "Director"),
    ),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const type = searchParams.get("type") ?? "title"; // "title" | "actor" | "director"

  if (!query || query.trim() === "") {
    return badRequest("Missing 'query' query parameter");
  }

  const trimmed = query.trim();

  try {
    let films;

    if (type === "actor") {
      films = (await searchPersonCredits(trimmed)).actor;
    } else if (type === "director") {
      films = (await searchPersonCredits(trimmed)).director;
    } else if (type === "all") {
      // One leg failing must not discard the other's completed lookups.
      const [titleResult, personResult] = await Promise.allSettled([
        searchByTitle(trimmed),
        searchPersonCredits(trimmed),
      ]);
      const values: [Film[] | undefined, { actor: Film[]; director: Film[] } | undefined] = [
        titleResult.status === "fulfilled" ? titleResult.value : undefined,
        personResult.status === "fulfilled" ? personResult.value : undefined,
      ];
      const firstRejection =
        titleResult.status === "rejected"
          ? titleResult.reason
          : personResult.status === "rejected"
            ? personResult.reason
            : null;

      // Positional, not searched: a rejected leg leaves `undefined` here, and
      // a shape predicate would match that hole before the leg that succeeded.
      const titleFilms = values[0] ?? [];
      const person = values[1] ?? { actor: [], director: [] };

      const seen = new Set<number>();
      films = [...titleFilms, ...person.actor, ...person.director]
        .filter((f: { id: number }) => {
          if (seen.has(f.id)) return false;
          seen.add(f.id);
          return true;
        })
        .slice(0, 20);

      // Nothing from either leg plus a real failure is an outage, not "no hits".
      if (films.length === 0 && firstRejection) throw firstRejection;
    } else {
      films = await searchByTitle(trimmed);
    }

    return NextResponse.json({ films });
  } catch (error) {
    return tmdbError(error, "Failed to search films");
  }
}
