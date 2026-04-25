import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import type { MovieVideo } from "@/lib/types";

export const revalidate = 86400;

const TYPE_ORDER: Record<string, number> = {
  Trailer: 0,
  Teaser: 1,
  Clip: 2,
  Featurette: 3,
  "Behind the Scenes": 4,
};

type RawVideo = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
};

// GET /api/movies/[id]/videos
// All YouTube videos for a movie, sorted by type (Trailer first) then date.
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
        { error: "Failed to fetch movie videos" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const raw: RawVideo[] = data.results ?? [];

    const videos: MovieVideo[] = raw
      .filter((v) => v.site === "YouTube")
      .map((v) => ({
        id: v.id,
        key: v.key,
        name: v.name,
        site: v.site,
        type: v.type,
        official: v.official,
        published_at: v.published_at,
      }))
      .sort((a, b) => {
        const orderA = TYPE_ORDER[a.type] ?? 99;
        const orderB = TYPE_ORDER[b.type] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        return b.published_at.localeCompare(a.published_at);
      });

    return NextResponse.json({ videos });
  } catch (error) {
    return internalError(error, "Failed to fetch movie videos");
  }
}
