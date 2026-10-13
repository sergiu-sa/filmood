import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { MAX_PARTICIPANTS } from "@/lib/constants";
import { resolveSession, resolveParticipant } from "@/lib/group-api";
import { badRequest, internalError } from "@/lib/api-errors";

// POST /api/group/join
// Joins an existing group session by code.
// Auth is optional — guests provide a nickname, logged-in users use their name.
// Body: { code: string, nickname?: string, participantId?: string }
// Returns: { sessionId, participantId, code }
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return badRequest("Invalid JSON body");
  const { code, nickname, participantId } = body as Record<string, unknown>;

  // Validate code format
  if (!code || typeof code !== "string" || code.length !== 6) {
    return badRequest("A valid 6-character session code is required");
  }

  // Guests must provide a nickname
  const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";
  if (!user && !trimmedNickname) {
    return badRequest("Nickname is required for guests");
  }

  // Validate nickname length
  if (trimmedNickname && (trimmedNickname.length < 2 || trimmedNickname.length > 20)) {
    return badRequest("Nickname must be between 2 and 20 characters");
  }

  try {
    const supabase = getSupabaseAdmin();
    const upperCode = code.toUpperCase();

    const { session, error: sessionErr } = await resolveSession<{
      id: string; status: string; created_at: string;
    }>(supabase, upperCode);
    if (sessionErr) {
      return sessionErr.status === 404
        ? NextResponse.json({ error: "Session not found. Check the code and try again." }, { status: 404 })
        : sessionErr;
    }

    // Only allow joining during lobby phase
    if (session.status !== "lobby") {
      return badRequest("This session has already started");
    }

    // Joining a lobby again gets the seat back: a guest's by the id this browser stored, so a second join
    // doesn't leave a seat that is never ready and blocks the start. Before the cap, since they already count.
    const { participant: existing, error: seatErr } = await resolveParticipant(
      supabase,
      session.id,
      user,
      typeof participantId === "string" ? participantId : null,
    );
    if (seatErr?.status === 500) return seatErr;

    if (existing) {
      if (!user) {
        const { error: renameError } = await supabase
          .from("session_participants")
          .update({ nickname: trimmedNickname })
          .eq("id", existing.id);
        if (renameError) return internalError(renameError, "Failed to join session");
      }
      return NextResponse.json({
        sessionId: session.id,
        participantId: existing.id,
        code: upperCode,
      });
    }

    // Check participant count
    const { count, error: countError } = await supabase
      .from("session_participants")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    if (countError) return internalError(countError, "Failed to join session");

    if (count !== null && count >= MAX_PARTICIPANTS) {
      return badRequest("This session is full");
    }

    // Determine the display name
    const displayName = user
      ? (user.user_metadata?.name || user.email?.split("@")[0] || "User")
      : trimmedNickname;

    // Add participant
    const { data: participant, error: participantError } = await supabase
      .from("session_participants")
      .insert({
        session_id: session.id,
        user_id: user?.id ?? null,
        nickname: displayName,
      })
      .select()
      .single();

    // The same user's other join got past the seat lookup above at the same moment and inserted first;
    // the unique (session_id, user_id) index (017) refused this one, so answer with that seat.
    if (user && participantError?.code === "23505") {
      const { participant: seat, error: seatErr } = await resolveParticipant(supabase, session.id, user, null);
      if (seatErr) return seatErr;
      return NextResponse.json({ sessionId: session.id, participantId: seat.id, code: upperCode });
    }

    if (participantError || !participant) {
      return internalError(participantError, "Failed to join session");
    }

    return NextResponse.json({
      sessionId: session.id,
      participantId: participant.id,
      code: upperCode,
    });
  } catch (error) {
    return internalError(error, "Failed to join session");
  }
}
