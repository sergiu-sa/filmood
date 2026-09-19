import { NextResponse } from "next/server";
import { TMDBError } from "@/lib/tmdb-fetch";

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
 * Build an error response for a failed TMDB call.
 *
 * Only a 404 is forwarded: "no such film" is the one upstream status that
 * describes the client's request rather than our server. Everything else —
 * 401 from a rotated key, 429 from our own rate limit, a TMDB outage never masquerades as this app's "not signed in" 401.
 *
 * 
 * 
 * Forwarding the raw status would also hand `NextResponse.json` values it
 * rejects: a 204/304 from an intermediary throws inside the caller's catch
 * block, turning a handled failure into an unhandled one.
 */
export function tmdbError(error: unknown, fallback: string) {
  if (error instanceof TMDBError && error.status === 404) {
    console.error(fallback, error.message);
    return NextResponse.json({ error: fallback }, { status: 404 });
  }
  return internalError(error, fallback);
}
