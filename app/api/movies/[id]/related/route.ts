import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBFilm, tmdbJsonOptional } from "@/lib/tmdb";
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
    // Either list may 404 for an obscure film; a missing one just means the
    // other wins the fallback, so an upstream failure is not fatal here.
    const [recData, simData] = await Promise.all([
      tmdbJsonOptional(`/movie/${movieId}/recommendations`),
      tmdbJsonOptional(`/movie/${movieId}/similar`),
    ]);

    const rec = ((recData as RawListResponse).results ?? []).filter(
      (f) => f.poster_path,
    );
    const sim = ((simData as RawListResponse).results ?? []).filter(
      (f) => f.poster_path,
    );

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
