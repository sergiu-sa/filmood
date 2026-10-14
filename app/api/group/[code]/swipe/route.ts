import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { confirmedIds, resolveSession, resolveParticipant } from "@/lib/group-api";
import { badRequest, internalError } from "@/lib/api-errors";
import type { DeckFilm, SwipeVote } from "@/lib/types";

const VALID_VOTES: SwipeVote[] = ["yes", "no", "maybe"];

// GET /api/group/[code]/swipe
// Returns the current participant's swipe progress for this session.
// Used to resume swiping after a page refresh.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const user = await getAuthUser(request);
  const participantId = request.nextUrl.searchParams.get("participantId");

  try {
    const supabase = getSupabaseAdmin();

    const { session, error: sessionErr } = await resolveSession<{
      id: string; host_id: string; status: string; movie_deck: DeckFilm[] | null; created_at: string;
    }>(supabase, code, "id, host_id, status, movie_deck, created_at");
    if (sessionErr) return sessionErr;

    if (session.status !== "swiping" && session.status !== "done") {
      return NextResponse.json(
        { error: "Session is not in swiping phase" },
        { status: 400 },
      );
    }

    const { participant, error: partErr } = await resolveParticipant<{
      id: string; has_swiped: boolean;
    }>(supabase, session.id, user, participantId, "id, has_swiped");
    if (partErr) return partErr;

    // Fetch this participant's existing swipes
    const { data: swipes } = await supabase
      .from("swipes")
      .select("movie_id, vote")
      .eq("session_id", session.id)
      .eq("participant_id", participant.id);

    // Fetch all participants' completion status
    const { data: allParticipants } = await supabase
      .from("session_participants")
      .select("id, user_id, nickname, has_swiped")
      .eq("session_id", session.id);

    const deck: DeckFilm[] = session.movie_deck ?? [];
    const votedIds = new Set((swipes ?? []).map((s) => s.movie_id));

    // Only a vote finishes a session, so one whose last unfinished player deleted their account (014 removes the
    // seat) would never finish: everyone left is done and the results route keeps answering "not ready".
    let sessionStatus = session.status;
    if (sessionStatus === "swiping" && allParticipants?.length && allParticipants.every((p) => p.has_swiped)) {
      await supabase.from("sessions").update({ status: "done" }).eq("id", session.id).eq("status", "swiping");
      sessionStatus = "done";
    }

    return NextResponse.json({
      sessionId: session.id,
      hostId: session.host_id,
      deck,
      swipes: swipes ?? [],
      progress: {
        swiped: votedIds.size,
        total: deck.length,
      },
      participants: (allParticipants ?? []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        nickname: p.nickname,
        has_swiped: p.has_swiped,
      })),
      sessionStatus,
    });
  } catch (error) {
    return internalError(error, "Failed to load swipe state");
  }
}

// POST /api/group/[code]/swipe
// Records an individual vote (yes/no/maybe) on a movie.
// Tracks completion: marks participant as done when they've swiped all cards.
// Transitions session to "done" when every participant finishes.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const user = await getAuthUser(request);
  let body: { participantId?: string; movieId?: number; vote?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { participantId, movieId, vote } = body;

  // Validate vote
  if (!vote || !VALID_VOTES.includes(vote as SwipeVote)) {
    return NextResponse.json(
      { error: "Vote must be yes, no, or maybe" },
      { status: 400 },
    );
  }

  if (movieId === undefined || movieId === null) {
    return NextResponse.json(
      { error: "movieId is required" },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const { session, error: sessionErr } = await resolveSession<{
      id: string; status: string; movie_deck: DeckFilm[] | null; created_at: string;
    }>(supabase, code, "id, status, movie_deck, created_at");
    if (sessionErr) return sessionErr;

    if (session.status !== "swiping") {
      return NextResponse.json(
        { error: "Session is not in swiping phase" },
        { status: 400 },
      );
    }

    // Validate movie exists in the deck
    const deck: DeckFilm[] = session.movie_deck ?? [];
    const movieExists = deck.some((film) => film.id === movieId);

    if (!movieExists) {
      return NextResponse.json(
        { error: "Movie is not in this session's deck" },
        { status: 400 },
      );
    }

    const { participant, error: partErr } = await resolveParticipant<{
      id: string; has_swiped: boolean;
    }>(supabase, session.id, user, participantId ?? null, "id, has_swiped");
    if (partErr) return partErr;

    if (participant.has_swiped) {
      return NextResponse.json(
        { error: "You have already finished swiping" },
        { status: 409 },
      );
    }

    // Insert the swipe vote — unique constraint (session_id, participant_id, movie_id)
    // prevents duplicate votes on the same movie
    const { error: swipeError } = await supabase.from("swipes").insert({
      session_id: session.id,
      participant_id: participant.id,
      movie_id: movieId,
      vote: vote as SwipeVote,
    });

    if (swipeError) {
      // Unique constraint violation = duplicate vote
      if (swipeError.code === "23505") {
        return NextResponse.json(
          { error: "Already voted on this movie" },
          { status: 409 },
        );
      }
      return internalError(swipeError, "Failed to record vote");
    }

    // Count how many movies this participant has now swiped
    const { count: swipeCount } = await supabase
      .from("swipes")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id)
      .eq("participant_id", participant.id);

    const totalInDeck = deck.length;
    const participantDone = (swipeCount ?? 0) >= totalInDeck;

    // Mark participant as done if they've swiped all cards
    if (participantDone) {
      await supabase
        .from("session_participants")
        .update({ has_swiped: true })
        .eq("id", participant.id);
    }

    // Check if all participants are now done
    let allDone = false;

    if (participantDone) {
      const { data: allParticipants } = await supabase
        .from("session_participants")
        .select("has_swiped")
        .eq("session_id", session.id);

      allDone = (allParticipants ?? []).every((p) => p.has_swiped);

      if (allDone) {
        // Compare-and-set on status so two simultaneous final-submitters
        // can't both flip the session — only the first observer of the
        // "swiping" state succeeds. Mirrors the pattern in mood/route.ts.
        await supabase
          .from("sessions")
          .update({ status: "done" })
          .eq("id", session.id)
          .eq("status", "swiping");
      }
    }

    return NextResponse.json({
      recorded: true,
      progress: {
        swiped: swipeCount ?? 0,
        total: totalInDeck,
      },
      participantDone,
      allDone,
    });
  } catch (error) {
    return internalError(error, "Failed to record vote");
  }
}

// PATCH /api/group/[code]/swipe
// The host finishes the session without the players who haven't: their seats go, and the votes they cast
// with them (001 cascades swipes), so the results count only who finished.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code } = await params;
  const confirmed = confirmedIds(await request.json().catch(() => null));
  if (!confirmed) return badRequest("participantIds must list who to leave out");

  try {
    const supabase = getSupabaseAdmin();

    const { session, error: sessionErr } = await resolveSession<{
      id: string; host_id: string; status: string; created_at: string;
    }>(supabase, code, "id, host_id, status, created_at");
    if (sessionErr) return sessionErr;

    if (session.host_id !== user.id) {
      return NextResponse.json({ error: "Only the host can finish without the others" }, { status: 403 });
    }

    if (session.status !== "swiping") {
      return NextResponse.json({ error: "Session is not in swiping phase" }, { status: 400 });
    }

    const { data: rows, error: loadErr } = await supabase
      .from("session_participants")
      .select("id, user_id, has_swiped")
      .eq("session_id", session.id);
    if (loadErr || !rows) return internalError(loadErr, "Failed to load participants");

    if (!rows.some((p) => p.user_id === user.id && p.has_swiped)) {
      return badRequest("Finish your own votes first");
    }

    // As on the mood page: nobody the host's confirm didn't name is removed.
    const leftOut = rows.filter((p) => !p.has_swiped).map((p) => p.id);
    if (leftOut.some((id) => !confirmed.has(id))) {
      return NextResponse.json(
        { error: "Someone else is still swiping. Check the list and try again." },
        { status: 409 },
      );
    }

    // Removed before the status moves, so a failed write can be retried. Only seats still unfinished: one that
    // finished since the read keeps its seat and counts.
    if (leftOut.length > 0) {
      const { error: removeErr } = await supabase
        .from("session_participants")
        .delete()
        .in("id", leftOut)
        .eq("has_swiped", false);
      if (removeErr) return internalError(removeErr, "Failed to remove players");
    }

    // Compare-and-set, as a last vote may be finishing the session at this moment.
    const { error: doneError } = await supabase
      .from("sessions")
      .update({ status: "done" })
      .eq("id", session.id)
      .eq("status", "swiping");
    if (doneError) return internalError(doneError, "Failed to finish session");

    return NextResponse.json({ removed: leftOut.length });
  } catch (error) {
    return internalError(error, "Failed to finish without the others");
  }
}
