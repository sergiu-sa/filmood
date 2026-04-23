import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { moodMap } from "@/lib/moodMap";
import { resolveMoodText } from "@/lib/moodResolver";
import { isEraKey, isTempoKey } from "@/lib/moodRefinements";
import { resolveSession, resolveParticipant } from "@/lib/group-api";
import { buildSharedDeck } from "@/lib/deck";
import { internalError } from "@/lib/api-errors";
import { recordMoodPicks } from "@/lib/mood-history";
import type { EraKey, TempoKey } from "@/lib/types";

// POST /api/group/[code]/mood
// Save a participant's private mood selections + optional free-form text,
// era, and tempo. When all participants have submitted, build the shared
// movie deck and transition the session to "swiping".
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
    tempo?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { moods, participantId, text, era, tempo } = body;

  // Validate + coerce
  const tileMoods = Array.isArray(moods)
    ? moods.filter((m): m is string => typeof m === "string" && m in moodMap)
    : [];
  const trimmedText = typeof text === "string" ? text.trim() : "";

  // Resolve text → additional mood keys, keywords, era, tempo (chip values win).
  const resolved = trimmedText ? resolveMoodText(trimmedText) : null;

  const mergedMoodSet = new Set<string>(tileMoods);
  resolved?.moodKeys.forEach((k) => mergedMoodSet.add(k));
  const mergedMoods = [...mergedMoodSet];

  if (mergedMoods.length === 0) {
    const partialMatch =
      resolved !== null &&
      (resolved.era !== null ||
        resolved.tempo !== null ||
        resolved.keywords.length > 0);
    return NextResponse.json(
      {
        error: partialMatch
          ? "Add a feeling word — like 'funny', 'dark', or 'cozy'. Era or tempo alone isn't enough."
          : "Pick at least one mood tile or describe your mood",
      },
      { status: 400 },
    );
  }

  const finalEra: EraKey | null = isEraKey(era) ? era : resolved?.era ?? null;
  const finalTempo: TempoKey | null = isTempoKey(tempo)
    ? tempo
    : resolved?.tempo ?? null;
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
        tempo: finalTempo,
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
      .select("mood_selections, era, tempo, extra_keywords")
      .eq("session_id", session.id);

    // Without this guard a failed query (allParticipants === null) would slip
    // past the `submitted < total` check (both 0) and crash inside buildSharedDeck.
    if (loadErr || !allParticipants) {
      return internalError(loadErr, "Failed to load participants");
    }

    // Record this participant's mood picks for signed-in users (guests
    // skipped). Fire-and-forget — serverless waits for pending promises
    // before exit, so the insert completes reliably without blocking.
    if (user) {
      recordMoodPicks(supabase, user.id, mergedMoods).catch((err) =>
        console.error("mood_history insert failed", err),
      );
    }

    const total = allParticipants.length;
    const submitted = allParticipants.filter(
      (p) => p.mood_selections && p.mood_selections.length > 0,
    ).length;

    if (submitted < total) {
      return NextResponse.json({
        submitted: true,
        allDone: false,
        progress: { submitted, total },
      });
    }

    // All done — build the shared deck using mood_selections plus refinements.
    const deck = await buildSharedDeck(allParticipants);

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
