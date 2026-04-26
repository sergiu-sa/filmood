import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

const RECENT_LIMIT = 5;

interface SessionSummary {
  id: string;
  code: string;
  status: string;
  created_at: string;
  participantCount: number;
  participants: { nickname: string; user_id: string | null }[];
  /** Best-guess title from the deck — first film if a deck was built. */
  topPickTitle: string | null;
  topPickPoster: string | null;
}

// GET /api/profile/recent-sessions
// Returns the caller's most recent group sessions (any status), with the
// participant list for each. Replaces the placeholder Dune/Flow/Wild Robot
// fixtures in components/profile/RecentGroupSessions.tsx.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ sessions: [] });
  }

  try {
    const supabase = getSupabaseAdmin();

    // Most recent N session ids the caller has joined (any status).
    const { data: parts, error: partErr } = await supabase
      .from("session_participants")
      .select("session_id, joined_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false })
      .limit(RECENT_LIMIT);

    if (partErr) return internalError(partErr, "Failed to load sessions");
    const sessionIds = [
      ...new Set((parts ?? []).map((p) => p.session_id)),
    ].slice(0, RECENT_LIMIT);
    if (sessionIds.length === 0) return NextResponse.json({ sessions: [] });

    const [sessionsRes, allPartsRes] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, code, status, created_at, movie_deck")
        .in("id", sessionIds),
      supabase
        .from("session_participants")
        .select("session_id, nickname, user_id")
        .in("session_id", sessionIds),
    ]);

    if (sessionsRes.error) {
      return internalError(sessionsRes.error, "Failed to load sessions");
    }
    if (allPartsRes.error) {
      return internalError(allPartsRes.error, "Failed to load sessions");
    }

    const partsBySession = new Map<
      string,
      { nickname: string; user_id: string | null }[]
    >();
    for (const p of allPartsRes.data ?? []) {
      const arr = partsBySession.get(p.session_id) ?? [];
      arr.push({ nickname: p.nickname, user_id: p.user_id });
      partsBySession.set(p.session_id, arr);
    }

    const sessionRows = (sessionsRes.data ?? []) as Array<{
      id: string;
      code: string;
      status: string;
      created_at: string;
      movie_deck:
        | Array<{ title?: string; poster_path?: string | null }>
        | null;
    }>;

    const sessions: SessionSummary[] = sessionRows
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .map((s) => {
        const ps = partsBySession.get(s.id) ?? [];
        const top = (s.movie_deck ?? [])[0];
        return {
          id: s.id,
          code: s.code,
          status: s.status,
          created_at: s.created_at,
          participantCount: ps.length,
          participants: ps,
          topPickTitle: top?.title ?? null,
          topPickPoster: top?.poster_path ?? null,
        };
      });

    return NextResponse.json({ sessions });
  } catch (error) {
    return internalError(error, "Failed to load sessions");
  }
}
