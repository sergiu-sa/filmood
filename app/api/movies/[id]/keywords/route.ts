import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import { tmdbJson } from "@/lib/tmdb-fetch";
import type { Keyword } from "@/lib/types";

export const revalidate = 86400;

const KEYWORD_LIMIT = 20;

type RawKeyword = { id: number; name: string };

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
    const data = await tmdbJson(`/movie/${movieId}/keywords`);
    const raw = (data.keywords ?? []) as RawKeyword[];
    const keywords: Keyword[] = raw
      .slice(0, KEYWORD_LIMIT)
      .map((k) => ({ id: k.id, name: k.name }));

    return NextResponse.json({ keywords });
  } catch (error) {
    return tmdbError(error, "Failed to fetch movie keywords");
  }
}
