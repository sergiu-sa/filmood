import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { badRequest, internalError } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";

// POST /api/watchlist/add
// Saves a film to the user's watchlist.
// Body: { movie_id: number, movie_title: string, poster_path: string | null }
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A body of `null` parses but can't be destructured.
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
  const { movie_id: rawId, movie_title, poster_path } = body as Record<string, unknown>;
  const movie_id = parseTMDBId(String(rawId));

  if (movie_id === null) return badRequest("movie_id must be a positive integer");
  if (!movie_title || typeof movie_title !== "string") {
    return badRequest("movie_title is required");
  }

  // A film already saved keeps its first row (unique index, migration 015) and answers like a first save.
  const { error } = await getSupabaseAdmin()
    .from("watchlists")
    .upsert(
      {
        user_id: user.id,
        movie_id,
        movie_title,
        poster_path: typeof poster_path === "string" && poster_path ? poster_path : null,
      },
      { onConflict: "user_id,movie_id", ignoreDuplicates: true },
    );

  if (error) {
    return internalError(error, "Failed to add to watchlist");
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
