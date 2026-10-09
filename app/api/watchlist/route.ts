import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError, badRequest } from "@/lib/api-errors";
import { getFilmDetail } from "@/lib/filmData";
import { settleTMDB } from "@/lib/tmdb-fetch";

// GET /api/watchlist?limit=N&details=1
// Returns all saved films for the logged-in user, newest first.
// Optional ?limit=N caps the result set (1 ≤ N ≤ 100).
// ?details=1 adds each film's release_date and vote_average, null where its lookup failed.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  let limit: number | null = null;
  if (limitParam !== null) {
    const n = Number(limitParam);
    if (!Number.isInteger(n) || n < 1 || n > 100) {
      return badRequest("limit must be an integer between 1 and 100");
    }
    limit = n;
  }

  let query = getSupabaseAdmin()
    .from("watchlists")
    .select("*")
    .eq("user_id", user.id)
    .order("added_at", { ascending: false });

  if (limit !== null) {
    query = query.limit(limit);
  }

  const { data, error } = await query;

  if (error) {
    return internalError(error, "Failed to load watchlist");
  }

  if (request.nextUrl.searchParams.get("details") !== "1") {
    return NextResponse.json({ watchlist: data });
  }

  // ponytail: one lookup per saved film, all at once, through the film page's 24 h cache. A cold cache
  // on hundreds of films can hit TMDB's rate limit (those cards lose rating and year): page the grid then.
  const { values } = await settleTMDB(data.map((row) => getFilmDetail(row.movie_id)), () => false);
  return NextResponse.json({
    watchlist: data.map((row, i) => ({
      ...row,
      // TMDB's date for an undated film is "", which FilmCard would show as "N/A".
      release_date: values[i]?.release_date || null,
      vote_average: values[i]?.vote_average ?? null,
    })),
  });
}
