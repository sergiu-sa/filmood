import { after, NextRequest, NextResponse } from "next/server";
import { MAX_MOODS, moodMap, normalizeMoodKeys } from "@/lib/moodMap";
import { MAX_TEXT_LENGTH, resolveMoodText } from "@/lib/moodResolver";
import { isWhereKey, parseFilters, removableFilterKeys } from "@/lib/moodFilters";
import { runMoodSearch } from "@/lib/moodSearch";
import { resolveWhere } from "@/lib/watchProviders";
import { mulberry32, newSeed, parseSeed } from "@/lib/seededRandom";
import { parseSource, recordSearchEvent } from "@/lib/searchLog";
import { mapTMDBDiscoverFilm } from "@/lib/tmdb";
import { badRequest, internalError } from "@/lib/api-errors";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { recordMoodPicks } from "@/lib/mood-history";
import type { DiscoverResponse } from "@/lib/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // The input's maxLength is not a security boundary.
  const text = (searchParams.get("text") ?? "").trim().slice(0, MAX_TEXT_LENGTH);

  // Resolve the optional free-form text into mood keys + keywords + era/time.
  // Explicit params win over anything inferred from the text.
  const resolved = text ? resolveMoodText(text) : null;

  const tileKeys = normalizeMoodKeys((searchParams.get("mood") ?? "").split(","));
  const textKeys = resolved?.moodKeys ?? [];
  const allKeys = [...new Set([...tileKeys, ...textKeys])];
  const moodKeys = allKeys.slice(0, MAX_MOODS);

  if (moodKeys.length === 0) {
    // Resolver picked up era/time/keywords but no mood word — we need at least
    // one mood signal to build a genre query, so nudge the user toward one.
    const partialMatch =
      resolved !== null &&
      (resolved.era !== null ||
        resolved.time !== null ||
        resolved.keywords.length > 0);
    return badRequest(
      partialMatch
        ? "Add a feeling word — like 'funny', 'dark', or 'cozy'. A length or an era alone isn't enough."
        : "Provide a mood tile or describe your mood",
    );
  }

  const filters = parseFilters(searchParams, resolved);
  // D4: no Where means the user's services when there are some; resolveWhere settles on Norway otherwise and says so.
  const requested = isWhereKey(searchParams.get("where")) ? filters : { ...filters, where: "mine" as const };
  const seed = parseSeed(searchParams.get("seed")) ?? newSeed();

  try {
    const user = await getAuthUser(request);
    // after(), not an unawaited promise: Next keeps the function alive until it
    // finishes, which an unawaited promise isn't guaranteed.
    if (user) {
      after(() =>
        recordMoodPicks(getSupabaseAdmin(), user.id, moodKeys).catch((err) =>
          console.error("mood_history insert failed", err),
        ),
      );
    }

    // A failed saved-services read is a 500 like any other failure, never a quiet Norway.
    const settled = await resolveWhere(
      requested,
      searchParams.get("services"),
      user ? { supabase: getSupabaseAdmin(), userId: user.id } : null,
    );
    const result = await runMoodSearch(
      moodKeys,
      settled,
      mulberry32(seed),
      removableFilterKeys(searchParams, resolved),
    );
    const { time, era, where } = settled;

    const body: DiscoverResponse = {
      moods: moodKeys.map((k) => ({
        key: k,
        label: moodMap[k].tagLabel,
        accent: moodMap[k].accentColor,
      })),
      droppedMoods: allKeys.slice(MAX_MOODS),
      films: result.films.map(mapTMDBDiscoverFilm),
      filters: { time, era, where },
      seed,
      relaxed: result.relaxed,
      partial: result.partial,
      interpreted: resolved
        ? {
            text,
            moods: textKeys,
            era: resolved.era,
            time: resolved.time,
            unmatched: resolved.unmatched,
          }
        : null,
      suggestions: result.suggestions,
      relatedMoods: result.relatedMoods,
    };

    const logged = Object.fromEntries(
      Object.entries(body.filters).filter(([, v]) => v !== null),
    ) as Record<string, string>;
    // Async so a missing admin client rejects into the catch instead of throwing.
    after(async () => {
      try {
        await recordSearchEvent(getSupabaseAdmin(), {
          moods: moodKeys,
          filters: logged,
          hasText: text.length > 0,
          source: parseSource(searchParams.get("src")),
          resultCount: body.films.length,
          relaxed: body.relaxed,
          partial: body.partial,
          suggestionsShown: body.suggestions.length > 0,
        });
      } catch (err) {
        console.error("search_events insert failed", err);
      }
    });

    return NextResponse.json(body);
  } catch (error) {
    return internalError(error, "Failed to fetch films");
  }
}
