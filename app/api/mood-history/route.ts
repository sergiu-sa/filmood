import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

const TOP_N = 5;

// GET /api/mood-history
// Returns the signed-in user's most-used moods, top-N by pick count.
// Client-side aggregation (fetch all rows + count in JS) is fine for
// portfolio-scale data — rarely more than a few hundred rows per user.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("mood_history")
      .select("mood")
      .eq("user_id", user.id);

    if (error) return internalError(error, "Failed to load mood history");

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.mood, (counts.get(row.mood) ?? 0) + 1);
    }

    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([mood, count]) => ({ mood, count }));

    return NextResponse.json({ top });
  } catch (error) {
    return internalError(error, "Failed to load mood history");
  }
}
