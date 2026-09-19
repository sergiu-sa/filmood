import { NextRequest, NextResponse } from "next/server";
import { mapTMDBFilm, tmdbJson } from "@/lib/tmdb";
import { tmdbError, badRequest } from "@/lib/api-errors";

type Endpoint = { path: string; params: Record<string, string> };

function isoDay(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Map a browse category to its TMDB endpoint. `page` and the genre id are the
 * only caller-supplied values; everything else is fixed per category.
 * Returns null for an unknown category so the handler can 400.
 */
function endpointFor(category: string, page: string, genreId: string | null): Endpoint | null {
  const base = { language: "en-US", page };

  switch (category) {
    case "trending":
      return { path: "/trending/movie/day", params: base };

    case "top-rated":
      return { path: "/movie/top_rated", params: base };

    case "new-releases": {
      const today = new Date();
      const oneYearAgo = new Date(today);
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      return {
        path: "/discover/movie",
        params: {
          ...base,
          sort_by: "release_date.desc",
          include_adult: "false",
          include_video: "false",
          "vote_count.gte": "10",
          "primary_release_date.gte": isoDay(oneYearAgo),
          "primary_release_date.lte": isoDay(today),
        },
      };
    }

    case "in-cinemas":
      return { path: "/movie/now_playing", params: { ...base, region: "NO" } };

    case "by-genre":
      return {
        path: "/discover/movie",
        params: {
          ...base,
          sort_by: "popularity.desc",
          ...(genreId ? { with_genres: genreId } : {}),
        },
      };

    case "streaming-norway":
      return {
        path: "/discover/movie",
        params: {
          ...base,
          sort_by: "popularity.desc",
          watch_region: "NO",
          with_watch_monetization_types: "flatrate",
        },
      };

    default:
      return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const genreId = searchParams.get("genre");
  const page = searchParams.get("page") ?? "1";

  if (!category) return badRequest("Missing 'category' query parameter");

  const endpoint = endpointFor(category, page, genreId);
  if (!endpoint) return badRequest("Invalid category");

  try {
    // Uncached: results are page- and genre-scoped and change with TMDB's
    // popularity ordering, matching this route's long-standing behaviour.
    const data = await tmdbJson<{
      results?: Parameters<typeof mapTMDBFilm>[0][];
      total_pages?: number;
    }>(endpoint.path, endpoint.params, false);

    const films = (data.results ?? []).map(mapTMDBFilm);
    return NextResponse.json({ films, totalPages: data.total_pages ?? 1 });
  } catch (error) {
    return tmdbError(error, "Failed to browse films");
  }
}
