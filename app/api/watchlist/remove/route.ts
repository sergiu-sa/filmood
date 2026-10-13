import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { badRequest, internalError } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";

// DELETE /api/watchlist/remove
// Removes a film from the user's watchlist.
// Body: { movie_id: number }
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A body of `null` parses but can't be destructured.
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
  const { movie_id: rawId } = body as Record<string, unknown>;
  const movie_id = parseTMDBId(String(rawId));

  if (movie_id === null) return badRequest("movie_id must be a positive integer");

  // Delete only the row matching this user + this movie
  const { error } = await getSupabaseAdmin()
    .from("watchlists")
    .delete()
    .eq("user_id", user.id)
    .eq("movie_id", movie_id);

  if (error) {
    return internalError(error, "Failed to remove from watchlist");
  }

  return NextResponse.json({ success: true });
}
