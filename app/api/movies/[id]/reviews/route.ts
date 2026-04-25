import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, tmdbImageUrl } from "@/lib/tmdb";
import type { Review } from "@/lib/types";

export const revalidate = 86400;

const REVIEW_LIMIT = 5;

type RawReview = {
  id: string;
  author: string;
  author_details?: {
    avatar_path?: string | null;
    rating?: number | null;
  } | null;
  content: string;
  created_at: string;
  url: string;
};

/**
 * TMDB stores Gravatar avatars as `/https://...` (path starts with a slash
 * containing the full URL). When the path begins with `/http`, strip the
 * leading slash to get the real URL — otherwise it's a TMDB-hosted relative
 * path and we resolve it via the image CDN.
 */
function resolveAvatar(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  if (rawPath.startsWith("/http")) return rawPath.slice(1);
  return tmdbImageUrl(rawPath, "w185");
}

// GET /api/movies/[id]/reviews
// Top REVIEW_LIMIT reviews, newest first.
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
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${movieId}/reviews?api_key=${apiKey}`,
      { next: { revalidate: 86400 } },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch movie reviews" },
        { status: response.status },
      );
    }

    const data = await response.json();
    const raw: RawReview[] = data.results ?? [];

    const reviews: Review[] = [...raw]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, REVIEW_LIMIT)
      .map((r) => ({
        id: r.id,
        author: r.author,
        rating: r.author_details?.rating ?? null,
        avatar_url: resolveAvatar(r.author_details?.avatar_path),
        content: r.content,
        created_at: r.created_at,
        url: r.url,
      }));

    return NextResponse.json({ reviews });
  } catch (error) {
    return internalError(error, "Failed to fetch movie reviews");
  }
}
