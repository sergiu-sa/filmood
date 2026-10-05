import { after, NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { MAX_MOODS, normalizeMoodKeys } from "@/lib/moodMap";
import { MAX_TEXT_LENGTH, resolveMoodText } from "@/lib/moodResolver";
import { isEraKey, isTempoKey, isTimeKey, LEGACY_TEMPO_TIME } from "@/lib/moodFilters";
import { resolveSession, resolveParticipant } from "@/lib/group-api";
import { buildSharedDeck } from "@/lib/deck";
import { groupProviders } from "@/lib/watchProviders";
import { badRequest, internalError } from "@/lib/api-errors";
import { recordMoodPicks } from "@/lib/mood-history";
import type { EraKey, TimeKey } from "@/lib/types";

// POST /api/group/[code]/mood
// Save a participant's private mood selections (two at most) + optional
// free-form text, era, and time. When all participants have submitted, build
// the shared movie deck and transition the session to "swiping".
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  const user = await getAuthUser(request);
  let body: {
    moods?: string[];
    participantId?: string;
    text?: string;
    era?: string;
    time?: string;
    /** Sent by the mood page before it had Time. */
    tempo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const { moods, participantId, text, era, time, tempo } = body;

  // Validate + coerce
  const tileMoods = Array.isArray(moods)
    ? normalizeMoodKeys(moods.filter((m): m is string => typeof m === "string"))
    : [];
  // A lock-in can't be undone, so a third tile is refused rather than dropped.
  if (tileMoods.length > MAX_MOODS) return badRequest("Pick up to two moods.");
  // The input's maxLength is not a security boundary.
  const trimmedText = typeof text === "string" ? text.trim().slice(0, MAX_TEXT_LENGTH) : "";

  // Resolve text → additional mood keys, keywords, era, time (explicit values win).
  const resolved = trimmedText ? resolveMoodText(trimmedText) : null;

  // Tiles first, then the text's moods, two in all: the order discover uses.
  const mergedMoods = [...new Set([...tileMoods, ...(resolved?.moodKeys ?? [])])].slice(0, MAX_MOODS);

  if (mergedMoods.length === 0) {
    const partialMatch =
      resolved !== null &&
      (resolved.era !== null ||
        resolved.time !== null ||
        resolved.keywords.length > 0);
    return badRequest(
      partialMatch
        ? "Add a feeling word — like 'funny', 'dark', or 'cozy'. A length or an era alone isn't enough."
        : "Pick at least one mood tile or describe your mood",
    );
  }

  const finalEra: EraKey | null = isEraKey(era) ? era : resolved?.era ?? null;
  const finalTime: TimeKey | null = isTimeKey(time)
    ? time
    : isTempoKey(tempo)
      ? LEGACY_TEMPO_TIME[tempo]
      : resolved?.time ?? null;
  const extraKeywords = resolved?.keywords ?? [];

  try {
    const supabase = getSupabaseAdmin();

    const { session, error: sessionErr } = await resolveSession<{
      id: string; status: string; created_at: string;
    }>(supabase, code);
    if (sessionErr) return sessionErr;

    if (session.status !== "mood") {
      return NextResponse.json(
        { error: "Session is not in mood selection phase" },
        { status: 400 },
      );
    }

    const { participant, error: partErr } = await resolveParticipant<{
      id: string; mood_selections: string[] | null;
    }>(supabase, session.id, user, participantId ?? null, "id, mood_selections");
    if (partErr) return partErr;

    if (participant.mood_selections && participant.mood_selections.length > 0) {
      return NextResponse.json(
        { error: "You have already submitted your moods" },
        { status: 409 },
      );
    }

    const { error: updateError } = await supabase
      .from("session_participants")
      .update({
        mood_selections: mergedMoods,
        mood_text: trimmedText || null,
        era: finalEra,
        time: finalTime,
        // A row rolled back from before migration 010 keeps its tempo, which the deck reads when time is null.
        tempo: null,
        extra_keywords: extraKeywords,
      })
      .eq("id", participant.id);

    if (updateError) {
      return internalError(updateError, "Failed to save moods");
    }

    // Check if all participants have now submitted. Pull the full refinement
    // payload for deck-building in one round-trip.
    const { data: allParticipants, error: loadErr } = await supabase
      .from("session_participants")
      .select("mood_selections, era, time, tempo, extra_keywords, user_id")
      .eq("session_id", session.id);

    // Without this guard a failed query (allParticipants === null) would slip
    // past the `submitted < total` check (both 0) and crash inside buildSharedDeck.
    if (loadErr || !allParticipants) {
      return internalError(loadErr, "Failed to load participants");
    }

    // Signed-in users only. after() also runs when the handler fails, so it's
    // scheduled only once the submission stands: a rolled-back pick isn't one.
    const recordPicks = () => {
      if (!user) return;
      after(() =>
        recordMoodPicks(supabase, user.id, mergedMoods).catch((err) =>
          console.error("mood_history insert failed", err),
        ),
      );
    };

    const total = allParticipants.length;
    const submitted = allParticipants.filter(
      (p) => p.mood_selections && p.mood_selections.length > 0,
    ).length;

    if (submitted < total) {
      recordPicks();
      return NextResponse.json({
        submitted: true,
        allDone: false,
        progress: { submitted, total },
      });
    }

    // All done — build the shared deck using mood_selections plus refinements.
    let deck;
    try {
      const userIds = allParticipants.flatMap((p) => p.user_id ?? []);
      deck = await buildSharedDeck(allParticipants, await groupProviders(supabase, userIds));
    } catch (deckError) {
      // The moods above are already committed and the "already submitted"
      // guard would reject every retry, so a TMDB outage here would wedge the
      // session. Undo this participant's submission so the form comes back.
      //
      // Re-read the status first: a simultaneous submitter may have built the
      // deck and moved the session on, in which case rolling back would show
      // them as "hasn't submitted" for a session already swiping.
      const { data: current } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", session.id)
        .single();

      if (current?.status === "mood") {
        const { error: rollbackError } = await supabase
          .from("session_participants")
          .update({ mood_selections: null })
          .eq("id", participant.id);
        // A failed rollback is the wedge this block exists to prevent, so it
        // must be visible in the logs rather than swallowed.
        if (rollbackError) {
          console.error("Mood rollback failed — session may be stuck", rollbackError);
        }
      }
      return internalError(deckError, "Failed to build the movie deck");
    }

    // Atomic compare-and-set on session.status so simultaneous last-submitters
    // don't both write a deck. Whichever request wins flips status to "swiping";
    // the loser's UPDATE matches zero rows and we skip silently — both clients
    // get the redirect regardless.
    const { data: claimed, error: deckError } = await supabase
      .from("sessions")
      .update({ movie_deck: deck, status: "swiping" })
      .eq("id", session.id)
      .eq("status", "mood")
      .select("id");

    if (deckError) {
      return internalError(deckError, "Failed to build deck");
    }

    recordPicks();
    return NextResponse.json({
      submitted: true,
      allDone: true,
      deckSize: deck.length,
      claimedBuild: (claimed?.length ?? 0) > 0,
    });
  } catch (error) {
    return internalError(error, "Failed to submit moods");
  }
}
