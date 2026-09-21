import type { Film, Provider } from "@/lib/types";

// Minimal shape we care about from a TMDB discover/search/list response.
// TMDB returns many extra fields (popularity, adult, video, genre_ids, ...);
// mapTMDBFilm is the explicit boundary that drops them before they reach
// the client.
type TMDBFilmRaw = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
};

export function mapTMDBFilm(raw: TMDBFilmRaw): Film {
  return {
    id: raw.id,
    title: raw.title,
    poster_path: raw.poster_path,
    release_date: raw.release_date,
    vote_average: raw.vote_average,
    overview: raw.overview,
  };
}

// TMDB's /watch/providers response includes extra fields like
// display_priority that the client doesn't need. mapTMDBProvider is the
// equivalent server→client boundary for Provider.
export type TMDBProviderRaw = {
  provider_id: number;
  provider_name: string;
  logo_path: string;
};

export function mapTMDBProvider(raw: TMDBProviderRaw): Provider {
  return {
    provider_id: raw.provider_id,
    provider_name: raw.provider_name,
    logo_path: raw.logo_path,
  };
}

/**
 * Validate a route-param movie id and return it as a number, or null if it
 * isn't a positive integer. Used by `/api/movies/[id]/*` route handlers to
 * fail fast with a 400 instead of forwarding arbitrary strings into TMDB
 * URLs (where they'd 404 via a slower path, or worse, survive as path
 * traversal into an adjacent endpoint).
 */
export function parseTMDBId(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * TMDB image size tokens. The CDN serves any path at any of these widths;
 * the `original` token is the unaltered upload. Sizes are documented at
 * https://developer.themoviedb.org/reference/configuration-details — kept
 * as a literal union here so the helper is fully typed without a runtime
 * configuration call.
 */
export type TMDBImageSize =
  | "w45"
  | "w92"
  | "w154"
  | "w185"
  | "w300"
  | "w342"
  | "w500"
  | "w780"
  | "w1280"
  | "h632"
  | "original";

const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

/**
 * Build a full TMDB image URL from a relative path and size token. Returns
 * null when path is null so callers can render a placeholder.
 *
 * Single source of truth for TMDB image URLs across the app — never
 * concatenate `image.tmdb.org/t/p/...` strings inline.
 */
export function tmdbImageUrl(
  path: string | null | undefined,
  size: TMDBImageSize,
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}
