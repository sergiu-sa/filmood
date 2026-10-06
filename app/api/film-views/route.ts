import { NextRequest, NextResponse, after } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { badRequest, internalError } from "@/lib/api-errors";
import { parseTMDBId } from "@/lib/tmdb";
import { getFilmDetail } from "@/lib/filmData";
import { recordFilmView } from "@/lib/film-views";

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

// POST /api/film-views  { movie_id }
// Records that the signed-in user opened a film page. Only the id comes from
// the client: the title and poster are looked up (cached for a day), so no
// client-sent text is stored.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sign in to record views" }, { status: 401 });
  }

  let body: { movie_id?: unknown } | null;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  const movieId = parseTMDBId(String(body?.movie_id));
  if (movieId === null) return badRequest("Invalid movie id");

  after(() =>
    getFilmDetail(movieId)
      .then((film) =>
        recordFilmView(getSupabaseAdmin(), user.id, {
          movie_id: film.id,
          movie_title: film.title,
          poster_path: film.poster_path,
        }),
      )
      .catch((err) => console.error("Film view not recorded", err)),
  );

  return new NextResponse(null, { status: 204 });
}
