import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

const RAIL_LIMIT = 8;

// GET /api/film-views
// Recent film-detail-page views, deduped by movie_id (most recent wins).
// Powers the profile "Continue researching" rail. Excludes films the
// user has already saved to their watchlist — those graduate out of the
// rail and live in the watchlist surface instead.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ films: [] });

  try {
    const supabase = getSupabaseAdmin();

    const [viewsRes, watchlistRes] = await Promise.all([
      supabase
        .from("film_views")
        .select("movie_id, movie_title, poster_path, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(40),
      supabase.from("watchlists").select("movie_id").eq("user_id", user.id),
    ]);

    if (viewsRes.error) return internalError(viewsRes.error, "Failed to load views");
    if (watchlistRes.error)
      return internalError(watchlistRes.error, "Failed to load views");

    const saved = new Set(
      (watchlistRes.data ?? []).map((r) => r.movie_id as number),
    );

    const seen = new Set<number>();
    const films: Array<{
      movie_id: number;
      movie_title: string;
      poster_path: string | null;
      viewed_at: string;
    }> = [];
    for (const row of viewsRes.data ?? []) {
      if (saved.has(row.movie_id)) continue;
      if (seen.has(row.movie_id)) continue;
      seen.add(row.movie_id);
      films.push({
        movie_id: row.movie_id,
        movie_title: row.movie_title,
        poster_path: row.poster_path,
        viewed_at: row.viewed_at,
      });
      if (films.length >= RAIL_LIMIT) break;
    }

    return NextResponse.json({ films });
  } catch (error) {
    return internalError(error, "Failed to load views");
  }
}
