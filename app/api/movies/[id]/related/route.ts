import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBFilm } from "@/lib/tmdb";
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

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    );
  }

  try {
    const [recRes, simRes] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/recommendations?api_key=${apiKey}`,
        { next: { revalidate: 86400 } },
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/similar?api_key=${apiKey}`,
        { next: { revalidate: 86400 } },
      ),
    ]);

    const recData: RawListResponse = recRes.ok ? await recRes.json() : {};
    const simData: RawListResponse = simRes.ok ? await simRes.json() : {};

    const rec = (recData.results ?? []).filter((f) => f.poster_path);
    const sim = (simData.results ?? []).filter((f) => f.poster_path);

    const useRecommendations = rec.length > 0;
    const source: "recommendations" | "similar" = useRecommendations
      ? "recommendations"
      : "similar";

    const films: Film[] = (useRecommendations ? rec : sim)
      .slice(0, RELATED_LIMIT)
      .map(mapTMDBFilm);

    return NextResponse.json({ films, source });
  } catch (error) {
    return internalError(error, "Failed to fetch related films");
  }
}
