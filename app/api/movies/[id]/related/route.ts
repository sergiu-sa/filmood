import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBFilm } from "@/lib/tmdb";
import { tmdbJsonOptional, settleTMDB } from "@/lib/tmdb-fetch";
import type { Film } from "@/lib/types";

export const revalidate = 86400;

const RELATED_LIMIT = 16;

type RawListResponse = {
  results?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
    overview: string;
  }>;
};

// GET /api/movies/[id]/related
// Returns recommendations (TMDB's editorially-tuned list) when available,
// falling back to similar (algorithmic by genre+keywords). Reports `source`
// so the UI can label the rail correctly.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = parseTMDBId(id);
  if (movieId === null) return badRequest("Invalid movie id");

  try {
    // A fallback pair: one leg failing must not discard the other.
    const { values, firstRejection } = await settleTMDB([
      tmdbJsonOptional<RawListResponse>(`/movie/${movieId}/recommendations`),
      tmdbJsonOptional<RawListResponse>(`/movie/${movieId}/similar`),
    ]);
    const [rec, sim] = [0, 1].map((i) =>
      (values[i]?.results ?? []).filter((f) => f.poster_path),
    );

    // Nothing usable plus a real failure is an outage, not "no related films".
    if (rec.length === 0 && sim.length === 0 && firstRejection) {
      throw firstRejection;
    }

    const useRecommendations = rec.length > 0;
    const source: "recommendations" | "similar" = useRecommendations
      ? "recommendations"
      : "similar";

    const films: Film[] = (useRecommendations ? rec : sim)
      .slice(0, RELATED_LIMIT)
      .map(mapTMDBFilm);

    return NextResponse.json({ films, source });
  } catch (error) {
    return tmdbError(error, "Failed to fetch related films");
  }
}
