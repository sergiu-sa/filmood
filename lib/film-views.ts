import type { SupabaseClient } from "@supabase/supabase-js";

const PER_USER_RETENTION = 100;

interface ViewedFilm {
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
}

/**
 * Fire-and-forget — record that an authenticated user opened a film
 * detail page. Mirrors the `recordMoodPicks` shape: caller is the route
 * handler; callers `.catch(console.error)` and never `await` so the
 * insert lands without blocking the response. After insert, prunes the
 * user's rows beyond `PER_USER_RETENTION` to keep the table bounded.
 */
export async function recordFilmView(
  supabase: SupabaseClient,
  userId: string,
  film: ViewedFilm,
): Promise<void> {
  if (!Number.isInteger(film.movie_id) || film.movie_id <= 0) return;

  const { error } = await supabase.from("film_views").insert({
    user_id: userId,
    movie_id: film.movie_id,
    movie_title: film.movie_title,
    poster_path: film.poster_path ?? null,
  });
  if (error) throw error;

  // Trim per-user history to the most recent N rows. Cheap because the
  // (user_id, viewed_at desc) index is hot.
  const { data: keep } = await supabase
    .from("film_views")
    .select("id")
    .eq("user_id", userId)
    .order("viewed_at", { ascending: false })
    .limit(PER_USER_RETENTION);

  const keepIds = (keep ?? []).map((r) => r.id);
  if (keepIds.length === PER_USER_RETENTION) {
    await supabase
      .from("film_views")
      .delete()
      .eq("user_id", userId)
      .not("id", "in", `(${keepIds.join(",")})`);
  }
}
