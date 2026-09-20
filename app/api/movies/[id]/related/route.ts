import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBFilm } from "@/lib/tmdb";
import { tmdbJsonOptional } from "@/lib/tmdb-fetch";
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
    // The two lists are a fallback pair, so a failure on one leg must not
    // discard a good payload from the other. Only a total failure is reported.
    const settled = await Promise.allSettled([
      tmdbJsonOptional<RawListResponse>(`/movie/${movieId}/recommendations`),
      tmdbJsonOptional<RawListResponse>(`/movie/${movieId}/similar`),
    ]);
    if (settled.every((r) => r.status === "rejected")) {
      throw settled[0].status === "rejected"
        ? settled[0].reason
        : new Error("Failed to fetch related films");
    }

    const listOf = (r: (typeof settled)[number]) =>
      r.status === "fulfilled"
        ? (r.value.results ?? []).filter((f) => f.poster_path)
        : [];
    const rec = listOf(settled[0]);
    const sim = listOf(settled[1]);

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
