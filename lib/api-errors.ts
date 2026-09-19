import { NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb";

/**
 * Build a 500 response from an arbitrary thrown/returned error. Always logs
 * the full error server-side (Vercel captures stderr), and returns a safe
 * generic `fallback` to the client in production so Supabase/TMDB internals
 * don't leak. In development the real message surfaces to keep debugging
 * ergonomic.
 */
export function internalError(error: unknown, fallback: string) {
  console.error(fallback, error);
  const isDev = process.env.NODE_ENV === "development";
  const message =
    isDev && error instanceof Error && error.message ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/**
 * Build a 400 response with a user-safe message. Use for client-input
 * validation failures (bad params, missing fields, wrong types) so route
 * handlers read the same whether they're returning a 500 or a 400.
 */
export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Build an error response for a failed TMDB call. A `TMDBError` carries the
 * upstream status, so a 404 for an unknown film stays a 404 to the client
 * rather than becoming a generic 500. Anything else (missing key, network
 * failure, bad JSON) is a genuine server fault and routes to `internalError`.
 */
export function tmdbError(error: unknown, fallback: string) {
  if (error instanceof TMDBError) {
    console.error(fallback, error.message);
    return NextResponse.json({ error: fallback }, { status: error.status });
  }
  return internalError(error, fallback);
}
