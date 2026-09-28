import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";
import { countMoodPicks } from "@/lib/mood-history";

// GET /api/profile/stats
// Aggregates the four header stats: watchlist count, total mood picks,
// top mood key, sessions joined. One small admin query per stat — fast
// for portfolio-scale data; if it gets slow, switch to count(*) views.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const [watchlistRes, moodRes, sessionsRes] = await Promise.all([
      supabase
        .from("watchlists")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase.from("mood_history").select("mood").eq("user_id", user.id),
      supabase
        .from("session_participants")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    if (watchlistRes.error) {
      return internalError(watchlistRes.error, "Failed to load stats");
    }
    if (moodRes.error) {
      return internalError(moodRes.error, "Failed to load stats");
    }
    if (sessionsRes.error) {
      return internalError(sessionsRes.error, "Failed to load stats");
    }

    const topMood = countMoodPicks(moodRes.data ?? [])[0]?.[0] ?? null;

    return NextResponse.json({
      watchlistCount: watchlistRes.count ?? 0,
      moodPicks: moodRes.data?.length ?? 0,
      topMood,
      sessionsJoined: sessionsRes.count ?? 0,
    });
  } catch (error) {
    return internalError(error, "Failed to load stats");
  }
}
