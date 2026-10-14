import { NextRequest, NextResponse } from "next/server";
import { mapTMDBFilm } from "@/lib/tmdb";
import type { Film } from "@/lib/types";
import { settleTMDB, tmdbJson } from "@/lib/tmdb-fetch";
import { internalError, badRequest } from "@/lib/api-errors";

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

function uniqueById<T extends { id: number }>(items: T[]) {
  const seen = new Set<number>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/**
 * The first person TMDB's all-types search finds, and their films: acting and
 * directing together by popularity, so a director's films aren't cut for their
 * acting roles. `leads` is true when TMDB ranks that person above every film:
 * a person-only search always finds someone ("heat" finds a Percy Heat).
 */
async function searchPerson(query: string) {
  const { results = [] } = await tmdbJson<{ results?: { id: number; media_type: string }[] }>(
    "/search/multi",
    { language: "en-US", query, page: "1", include_adult: "false" },
    UNCACHED,
  );
  const person = results.find((r) => r.media_type === "person");
  if (!person) return { leads: false, films: [] };

  const credits = await tmdbJson<{ cast?: RawCredit[]; crew?: RawCredit[] }>(
    `/person/${person.id}/movie_credits`,
    { language: "en-US" },
    UNCACHED,
  );
  const directed = (credits.crew ?? []).filter((c) => c.job === "Director");

  return {
    // TV is skipped: this app lists films only.
    leads: results.find((r) => r.media_type !== "tv") === person,
    films: uniqueById([...(credits.cast ?? []), ...directed].sort((a, b) => b.popularity - a.popularity))
      .slice(0, 20)
      .map(mapTMDBFilm),
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const type = searchParams.get("type") ?? "title"; // "title" | "all"

  if (!query || query.trim() === "") {
    return badRequest("Missing 'query' query parameter");
  }

  const trimmed = query.trim();

  try {
    let films;

    if (type === "all") {
      // One leg failing must not discard the other's completed lookups.
      // Nothing from either leg plus a real failure is an outage, not "no hits".
      const { values } = await settleTMDB<{ films: Film[]; leads?: boolean }>(
        [searchByTitle(trimmed).then((films) => ({ films })), searchPerson(trimmed)],
        (legs) => legs.every((leg) => !leg?.films.length),
        "Search",
      );
      const [titles, person] = values;
      const legs = person?.leads ? [person, titles] : [titles, person];
      films = uniqueById(legs.flatMap((leg) => leg?.films ?? [])).slice(0, 20);
    } else {
      films = await searchByTitle(trimmed);
    }

    return NextResponse.json({ films });
  } catch (error) {
    return internalError(error, "Failed to search films");
  }
}
