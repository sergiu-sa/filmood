import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBProvider } from "@/lib/tmdb";
import type { TMDBProviderRaw } from "@/lib/tmdb";

export const revalidate = 86400;

// GET /api/movies/[id]/providers
// Streaming providers for a movie, scoped to Norway (country code "NO").
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
      `https://api.themoviedb.org/3/movie/${movieId}/watch/providers`,
    );
    url.searchParams.set("api_key", apiKey);
    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch watch providers" },
        { status: response.status },
      );
    }
    const data = await response.json();

    const results = data.results?.NO;
    if (!results) {
      return NextResponse.json({ providers: [] });
    }

    const allProviders: TMDBProviderRaw[] = [
      ...(results.flatrate ?? []),
      ...(results.rent ?? []),
      ...(results.buy ?? []),
    ];

    const uniqueProviders = Array.from(
      new Map(allProviders.map((p) => [p.provider_id, p])).values(),
    ).map(mapTMDBProvider);

    return NextResponse.json({ providers: uniqueProviders });
  } catch (error) {
    return internalError(error, "Internal server error");
  }
}
