import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, mapTMDBProvider } from "@/lib/tmdb";
import { tmdbJson } from "@/lib/tmdb-fetch";
import type { TMDBProviderRaw } from "@/lib/tmdb";

export const revalidate = 86400;

type ProviderGroup = {
  flatrate?: TMDBProviderRaw[];
  rent?: TMDBProviderRaw[];
  buy?: TMDBProviderRaw[];
};

// GET /api/movies/[id]/providers
// Streaming providers for a movie, scoped to Norway (country code "NO").
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = parseTMDBId(id);
  if (movieId === null) return badRequest("Invalid movie id");

  try {
    const data = await tmdbJson(`/movie/${movieId}/watch/providers`);

    const results = (data.results as Record<string, ProviderGroup> | undefined)
      ?.NO;
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
    return tmdbError(error, "Failed to fetch watch providers");
  }
}
