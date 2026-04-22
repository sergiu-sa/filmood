import { NextResponse } from "next/server";

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
