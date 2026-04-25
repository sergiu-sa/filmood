import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import type { TrailerData } from "@/lib/types";

export const revalidate = 86400;

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
      `https://api.themoviedb.org/3/movie/${movieId}/videos`,
    );
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch trailer" },
        { status: response.status },
      );
    }
    const data = await response.json();

    const results = (data.results ?? []) as TrailerData[];
    const trailer = results.find(
      (v) => v.site === "YouTube" && v.type === "Trailer",
    );
    if (!trailer) {
      return NextResponse.json({ trailer: null });
    }

    return NextResponse.json({
      trailer: {
        key: trailer.key,
        name: trailer.name,
        site: trailer.site,
        type: trailer.type,
      },
    });
  } catch (error) {
    return internalError(error, "Internal server error");
  }
}
