import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import type { MovieImage } from "@/lib/types";

export const revalidate = 86400;

const POSTER_LIMIT = 12;
const BACKDROP_LIMIT = 16;

type RawImage = {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
};

function project(raw: RawImage, kind: "poster" | "backdrop"): MovieImage {
  return {
    file_path: raw.file_path,
    width: raw.width,
    height: raw.height,
    aspect_ratio: raw.aspect_ratio,
    kind,
  };
}

// GET /api/movies/[id]/images
// Posters + backdrops, sorted by vote_average. include_image_language=en,null
// keeps English-titled and language-neutral images for non-English films.
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
      `https://api.themoviedb.org/3/movie/${movieId}/images`,
    );
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("include_image_language", "en,null");
    const response = await fetch(url.toString(), {
      next: { revalidate: 86400 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch movie images" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const rawPosters: RawImage[] = data.posters ?? [];
    const rawBackdrops: RawImage[] = data.backdrops ?? [];

    const posters = [...rawPosters]
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, POSTER_LIMIT)
      .map((p) => project(p, "poster"));

    const backdrops = [...rawBackdrops]
      .sort((a, b) => b.vote_average - a.vote_average)
      .slice(0, BACKDROP_LIMIT)
      .map((b) => project(b, "backdrop"));

    return NextResponse.json({ posters, backdrops });
  } catch (error) {
    return internalError(error, "Failed to fetch movie images");
  }
}
