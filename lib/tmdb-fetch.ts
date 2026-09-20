// Server-side TMDB access. Kept out of lib/tmdb.ts because that module is
// imported by ~14 "use client" components for `tmdbImageUrl`, and it is
// documented as secret-free so it can stay that way. Nothing here may be
// imported from a client component.
//
// (Adding the `server-only` package would enforce this at build time; today
// it rests on the split plus this comment.)

const TMDB_BASE = "https://api.themoviedb.org/3";

// Not exported: Next's `export const revalidate` segment config only accepts a
// literal, so each route repeats 86400 regardless. A shared constant here would
// imply a single source of truth that cannot exist.
const TMDB_REVALIDATE = 86400;

/**
 * A non-OK response from TMDB, carrying the upstream status.
 *
 * Only 404 is ever forwarded to our own clients — see `tmdbError`. The status
 * is kept on the error so callers can tell "this film does not exist" from
 * "our key is wrong", which look identical at the call site otherwise.
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
 * Throws `TMDBError` on a non-OK response and a plain `Error` when the key is
 * missing or the path is malformed — pair with `tmdbError(error, fallback)`
 * from `lib/api-errors`.
 *
 * `revalidate` is explicit rather than baked in: movie metadata caches for a
 * day, but the query-driven list routes (search, discover, browse, trending)
 * pass `false` to stay uncached.
 */
export async function tmdbJson<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate: number | false = TMDB_REVALIDATE,
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error("TMDB API key not configured");

  const url = new URL(`${TMDB_BASE}${path}`);

  // Require that the parser changed nothing. `new URL` folds dot segments, and
  // `%2e%2e` reaches the same endpoint as `..` while passing any substring
  // check on the input — but either way the pathname stops matching what was
  // asked for. A path that moved would carry the real key somewhere else.
  if (!path.startsWith("/") || url.pathname !== `/3${path}`) {
    throw new Error(`Invalid TMDB path: ${path}`);
  }

  url.searchParams.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  // `no-store` rather than omitting the option: uncached must not depend on a
  // route happening to lack an `export const revalidate` segment config.
  const response = await fetch(
    url.toString(),
    revalidate === false
      ? { cache: "no-store" }
      : { next: { revalidate } },
  );
  if (!response.ok) throw new TMDBError(response.status, path);
  return response.json();
}

/**
 * Like `tmdbJson`, but a 404 yields `{}` instead of throwing — for routes that
 * combine several calls and degrade to partial data when one is genuinely
 * absent for that film.
 *
 * **Only 404 is absorbed.** A 401 (wrong key), 429 (rate limited) or 5xx still
 * throws, so a misconfigured or throttled deployment surfaces as a 500 rather
 * than quietly serving empty results with a 200.
 */
export async function tmdbJsonOptional<T = Record<string, unknown>>(
  path: string,
  params: Record<string, string> = {},
  revalidate: number | false = TMDB_REVALIDATE,
): Promise<Partial<T>> {
  try {
    return await tmdbJson<T>(path, params, revalidate);
  } catch (error) {
    if (error instanceof TMDBError && error.status === 404) return {};
    throw error;
  }
}

/**
 * Run several TMDB calls and keep whatever succeeded, alongside the first
 * failure if there was one.
 *
 * Routes that combine calls should degrade on a partial failure and report a
 * total one — but "total" is not "every promise rejected". A 404 resolves to
 * `{}` through `tmdbJsonOptional`, so one leg 404ing while the other times out
 * leaves nothing usable and no rejection to trip an all-rejected check. Hence
 * the caller states its own emptiness condition in one line:
 *
 *     const { values, firstRejection } = await settleTMDB([a, b]);
 *     ...derive the result from values...
 *     if (result.length === 0 && firstRejection) throw firstRejection;
 */
export async function settleTMDB<T>(
  calls: Promise<T>[],
): Promise<{ values: T[]; firstRejection: unknown | null }> {
  const settled = await Promise.allSettled(calls);
  const rejected = settled.find(
    (r): r is PromiseRejectedResult => r.status === "rejected",
  );
  return {
    values: settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
    firstRejection: rejected ? rejected.reason : null,
  };
}
