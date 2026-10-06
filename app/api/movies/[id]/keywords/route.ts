import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import { getFilmKeywords } from "@/lib/filmData";

export const revalidate = 86400;

// GET /api/movies/[id]/keywords
// Themes/topics associated with a movie (TMDB keywords).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = parseTMDBId(id);
  if (movieId === null) return badRequest("Invalid movie id");

  try {
    return NextResponse.json({ keywords: await getFilmKeywords(movieId) });
  } catch (error) {
    return tmdbError(error, "Failed to fetch movie keywords");
  }
}
