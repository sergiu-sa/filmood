import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import { tmdbJson } from "@/lib/tmdb-fetch";
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

  try {
    const data = await tmdbJson(`/movie/${movieId}/images`, {
      include_image_language: "en,null",
    });
    const rawPosters = (data.posters ?? []) as RawImage[];
    const rawBackdrops = (data.backdrops ?? []) as RawImage[];

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
    return tmdbError(error, "Failed to fetch movie images");
  }
}
