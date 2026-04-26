import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

const EVENT_LIMIT = 12;

type EventKind = "watchlist" | "mood_pick" | "session_join" | "film_view";

interface TimelineEvent {
  id: string;
  at: string;
  kind: EventKind;
  /** Free-form payload the client renders into copy. */
  data: Record<string, unknown>;
}

// GET /api/profile/timeline
// Live-derived activity feed — no new schema. Pulls the most recent rows
// from watchlists, mood_history, session_participants, film_views; merges
// them into a single chronological list trimmed to EVENT_LIMIT.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ events: [] });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [
      watchlistRes,
      moodRes,
      sessionPartsRes,
      filmViewsRes,
    ] = await Promise.all([
      supabase
        .from("watchlists")
        .select("id, movie_id, movie_title, poster_path, added_at")
        .eq("user_id", user.id)
        .order("added_at", { ascending: false })
        .limit(EVENT_LIMIT),
      supabase
        .from("mood_history")
        .select("id, mood, picked_at")
        .eq("user_id", user.id)
        .order("picked_at", { ascending: false })
        .limit(EVENT_LIMIT),
      supabase
        .from("session_participants")
        .select("id, session_id, joined_at, sessions(code, status)")
        .eq("user_id", user.id)
        .order("joined_at", { ascending: false })
        .limit(EVENT_LIMIT),
      supabase
        .from("film_views")
        .select("id, movie_id, movie_title, poster_path, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false })
        .limit(EVENT_LIMIT),
    ]);

    if (watchlistRes.error) {
      return internalError(watchlistRes.error, "Failed to load timeline");
    }
    if (moodRes.error) {
      return internalError(moodRes.error, "Failed to load timeline");
    }
    if (sessionPartsRes.error) {
      return internalError(sessionPartsRes.error, "Failed to load timeline");
    }
    if (filmViewsRes.error) {
      return internalError(filmViewsRes.error, "Failed to load timeline");
    }

    const events: TimelineEvent[] = [];

    for (const r of watchlistRes.data ?? []) {
      events.push({
        id: `wl-${r.id}`,
        at: r.added_at,
        kind: "watchlist",
        data: {
          movie_id: r.movie_id,
          movie_title: r.movie_title,
          poster_path: r.poster_path,
        },
      });
    }
    for (const r of moodRes.data ?? []) {
      events.push({
        id: `mh-${r.id}`,
        at: r.picked_at,
        kind: "mood_pick",
        data: { mood: r.mood },
      });
    }
    for (const r of sessionPartsRes.data ?? []) {
      const session = r.sessions as unknown as
        | { code: string; status: string }
        | null;
      if (!session) continue;
      events.push({
        id: `sp-${r.id}`,
        at: r.joined_at,
        kind: "session_join",
        data: {
          session_id: r.session_id,
          code: session.code,
          status: session.status,
        },
      });
    }
    for (const r of filmViewsRes.data ?? []) {
      events.push({
        id: `fv-${r.id}`,
        at: r.viewed_at,
        kind: "film_view",
        data: {
          movie_id: r.movie_id,
          movie_title: r.movie_title,
          poster_path: r.poster_path,
        },
      });
    }

    events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    return NextResponse.json({ events: events.slice(0, EVENT_LIMIT) });
  } catch (error) {
    return internalError(error, "Failed to load timeline");
  }
}
