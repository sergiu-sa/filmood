import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
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

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    );
  }

  try {
    const url = new URL(
      `https://api.themoviedb.org/3/movie/${movieId}/keywords`,
    );
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch movie keywords" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const raw: RawKeyword[] = data.keywords ?? [];
    const keywords: Keyword[] = raw
      .slice(0, KEYWORD_LIMIT)
      .map((k) => ({ id: k.id, name: k.name }));

    return NextResponse.json({ keywords });
  } catch (error) {
    return internalError(error, "Failed to fetch movie keywords");
  }
}
