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
