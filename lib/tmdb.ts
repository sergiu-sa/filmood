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

const TMDB_BASE = "https://api.themoviedb.org/3";

/** Default ISR window for movie metadata — effectively static day to day. */
export const TMDB_REVALIDATE = 86400;

/**
 * A non-OK response from TMDB, carrying the upstream status so a route can
 * pass it through instead of flattening every upstream failure to a 500.
 */
export class TMDBError extends Error {
  constructor(readonly status: number, path: string) {
    super(`TMDB responded ${status} for ${path}`);
    this.name = "TMDBError";
  }
}

/**
 * Fetch and parse a TMDB endpoint. `path` is everything after `/3`
 * (e.g. `/movie/123/images`), so person and search endpoints work too.
 *
 * Throws `TMDBError` on a non-OK response and a plain `Error` when the key
 * is missing — pair with `tmdbError(error, fallback)` from `lib/api-errors`,
 * which maps the former to the upstream status and the latter to a 500.
 *
 * `revalidate` is explicit rather than baked in: movie metadata caches for a
 * day, but the query-driven list routes (search, discover, browse, trending)
 * pass `false` to stay uncached, which is how they have always behaved.
 */
export async function tmdbJson<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate: number | false = TMDB_REVALIDATE,
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB API key not configured");

  const url = new URL(`${TMDB_BASE}${path}`);
  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(
    url.toString(),
    revalidate === false ? undefined : { next: { revalidate } },
  );
  if (!response.ok) throw new TMDBError(response.status, path);
  return response.json();
}

/**
 * Like `tmdbJson`, but an upstream non-OK response yields `{}` instead of
 * throwing — for routes that combine several TMDB calls and degrade to
 * partial data rather than failing outright.
 *
 * Only `TMDBError` is absorbed. A missing API key or a network failure still
 * throws, so a misconfigured deployment surfaces as a 500 instead of quietly
 * returning empty results.
 */
export async function tmdbJsonOptional<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate: number | false = TMDB_REVALIDATE,
): Promise<Partial<T>> {
  try {
    return await tmdbJson<T>(path, params, revalidate);
  } catch (error) {
    if (error instanceof TMDBError) return {};
    throw error;
  }
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
