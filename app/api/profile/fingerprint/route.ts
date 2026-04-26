import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";
import { genreMap } from "@/lib/genres";

const TOP_MOODS = 3;
const TOP_GENRES = 5;

interface FingerprintResponse {
  topMoods: { mood: string; count: number }[];
  topGenres: { id: number; name: string; count: number }[];
}

// GET /api/profile/fingerprint
// "Your Filmood fingerprint" — top 3 moods (from mood_history) + top 5
// genres derived from the user's watchlist film genres. Sessions could
// also contribute genres but the deck is per-session and short-lived;
// watchlist is the durable signal.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const [moodRes, watchlistRes] = await Promise.all([
      supabase.from("mood_history").select("mood").eq("user_id", user.id),
      supabase.from("watchlists").select("movie_id").eq("user_id", user.id),
    ]);

    if (moodRes.error) {
      return internalError(moodRes.error, "Failed to load fingerprint");
    }
    if (watchlistRes.error) {
      return internalError(watchlistRes.error, "Failed to load fingerprint");
    }

    // ── Top moods ───────────────────────────────────────
    const moodCounts = new Map<string, number>();
    for (const row of moodRes.data ?? []) {
      moodCounts.set(row.mood, (moodCounts.get(row.mood) ?? 0) + 1);
    }
    const topMoods = [...moodCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_MOODS)
      .map(([mood, count]) => ({ mood, count }));

    // ── Top genres ──────────────────────────────────────
    // Pull genre_ids for each film in the watchlist via TMDB. Capped at
    // 30 films (most users) to keep this cheap; full sweep would need
    // /movie/{id} per film. The home page already pulls genre_ids on
    // discover responses but those aren't persisted, so we re-fetch.
    const movieIds = (watchlistRes.data ?? [])
      .map((r) => r.movie_id)
      .slice(0, 30);

    const genreCounts = new Map<number, number>();
    if (movieIds.length > 0) {
      const results = await Promise.all(
        movieIds.map(async (id) => {
          const url = new URL(`https://api.themoviedb.org/3/movie/${id}`);
          url.searchParams.set("api_key", apiKey);
          const res = await fetch(url.toString(), {
            next: { revalidate: 86400 },
          });
          if (!res.ok) return [];
          const data = (await res.json()) as {
            genres?: { id: number }[];
          };
          return data.genres ?? [];
        }),
      );
      for (const filmGenres of results) {
        for (const g of filmGenres) {
          genreCounts.set(g.id, (genreCounts.get(g.id) ?? 0) + 1);
        }
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_GENRES)
      .map(([id, count]) => ({
        id,
        name: genreMap[id] ?? `Genre ${id}`,
        count,
      }));

    const body: FingerprintResponse = { topMoods, topGenres };
    return NextResponse.json(body);
  } catch (error) {
    return internalError(error, "Failed to load fingerprint");
  }
}
