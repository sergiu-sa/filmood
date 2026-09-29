import { NextRequest, NextResponse } from "next/server";
import { MAX_MOODS, moodMap, normalizeMoodKeys } from "@/lib/moodMap";
import { resolveMoodText } from "@/lib/moodResolver";
import { parseRefinements } from "@/lib/moodFilters";
import { runMoodSearch } from "@/lib/moodSearch";
import { mulberry32, newSeed, parseSeed } from "@/lib/seededRandom";
import { parseSource, recordSearchEvent } from "@/lib/searchLog";
import { mapTMDBDiscoverFilm } from "@/lib/tmdb";
import { badRequest, tmdbError } from "@/lib/api-errors";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { recordMoodPicks } from "@/lib/mood-history";
import type { DiscoverResponse } from "@/lib/types";

// The input's maxLength is not a security boundary.
const MAX_TEXT_LENGTH = 120;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = (searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT_LENGTH);

  // Resolve the optional free-form text into mood keys + keywords + era/tempo.
  // Explicit chip values for era/tempo win over anything inferred from text.
  const resolved = text ? resolveMoodText(text) : null;

  const tileKeys = normalizeMoodKeys((searchParams.get("mood") ?? "").split(","));
  const textKeys = resolved?.moodKeys ?? [];
  const allKeys = [...new Set([...tileKeys, ...textKeys])];
  const moodKeys = allKeys.slice(0, MAX_MOODS);

  if (moodKeys.length === 0) {
    // Resolver picked up era/tempo/keywords but no mood word — we need at least
    // one mood signal to build a genre query, so nudge the user toward one.
    const partialMatch =
      resolved !== null &&
      (resolved.era !== null ||
        resolved.tempo !== null ||
        resolved.keywords.length > 0);
    return badRequest(
      partialMatch
        ? "Add a feeling word — like 'funny', 'dark', or 'cozy'. Era or tempo alone isn't enough."
        : "Provide a mood tile or describe your mood",
    );
  }

  // Record mood picks for signed-in users. Fire-and-forget — Vercel's
  // serverless runtime waits for pending promises before the function
  // exits, so the insert is reliable even though we don't await it here.
  const user = await getAuthUser(request);
  if (user) {
    recordMoodPicks(getSupabaseAdmin(), user.id, moodKeys).catch((err) =>
      console.error("mood_history insert failed", err),
    );
  }

  const refinements = parseRefinements(searchParams, resolved);
  const seed = parseSeed(searchParams.get("seed")) ?? newSeed();

  try {
    const result = await runMoodSearch(moodKeys, refinements, mulberry32(seed));

    const body: DiscoverResponse = {
      moods: moodKeys.map((k) => ({
        key: k,
        label: moodMap[k].tagLabel,
        accent: moodMap[k].accentColor,
      })),
      films: result.films.map(mapTMDBDiscoverFilm),
      seed,
      relaxed: result.relaxed,
      partial: result.partial,
      interpreted: resolved
        ? {
            text,
            moods: textKeys,
            era: resolved.era,
            tempo: resolved.tempo,
            unmatched: resolved.unmatched,
            droppedMoods: allKeys.slice(MAX_MOODS),
          }
        : null,
      suggestions: result.suggestions,
      relatedMoods: result.relatedMoods,
    };

    const { era, tempo, runtime } = refinements;
    const filters = Object.fromEntries(
      Object.entries({ era, tempo, runtime }).filter(([, v]) => v !== null),
    ) as Record<string, string>;
    // Fire-and-forget like recordMoodPicks, and wrapped so even a missing admin
    // client can't turn a finished search into an error.
    Promise.resolve()
      .then(() =>
        recordSearchEvent(getSupabaseAdmin(), {
          moods: moodKeys,
          filters,
          hasText: text.length > 0,
          source: parseSource(searchParams.get("src")),
          resultCount: body.films.length,
          relaxed: body.relaxed,
          partial: body.partial,
          suggestionsShown: body.suggestions.length > 0,
        }),
      )
      .catch((err) => console.error("search_events insert failed", err));

    return NextResponse.json(body);
  } catch (error) {
    return tmdbError(error, "Failed to fetch films");
  }
}
