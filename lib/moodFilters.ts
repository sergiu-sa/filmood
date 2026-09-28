// The user-chosen filters layered on top of a mood's TMDB query. Pure, so the
// discover route and scripts/check-moods.ts build the exact same query.

import {
  applyEra,
  applyTempo,
  mergeExtraKeywords,
  isEraKey,
  isTempoKey,
} from "@/lib/moodRefinements";
import type { ResolvedMoodText } from "@/lib/moodResolver";
import type { EraKey, TempoKey } from "@/lib/types";

export interface Refinements {
  runtime: string | null;
  language: string | null;
  exclude: string | null;
  era: EraKey | null;
  tempo: TempoKey | null;
  extraKeywords: number[];
}

export const EMPTY_REFINEMENTS: Refinements = {
  runtime: null,
  language: null,
  exclude: null,
  era: null,
  tempo: null,
  extraKeywords: [],
};

/** Explicit era/tempo params win over anything inferred from the free text. */
export function parseRefinements(
  sp: URLSearchParams,
  resolved: ResolvedMoodText | null,
): Refinements {
  const eraParam = sp.get("era");
  const tempoParam = sp.get("tempo");
  const exclude = sp.get("exclude") ?? "";
  return {
    runtime: sp.get("runtime"),
    language: sp.get("language"),
    // TMDB's without_genres takes a comma-separated id list; anything else
    // earns a 400 upstream, which would reach tmdbError and surface as our
    // 500 for what is purely client input.
    exclude: /^\d+(,\d+)*$/.test(exclude) ? exclude : null,
    era: isEraKey(eraParam) ? eraParam : resolved?.era ?? null,
    tempo: isTempoKey(tempoParam) ? tempoParam : resolved?.tempo ?? null,
    extraKeywords: resolved?.keywords ?? [],
  };
}

export function applyRefinements(
  params: Record<string, string>,
  r: Refinements,
): void {
  if (r.runtime === "short") {
    params["with_runtime.lte"] = "100";
  } else if (r.runtime === "long") {
    params["with_runtime.gte"] = "150";
  }

  if (r.language === "en") {
    params["with_original_language"] = "en";
  } else if (r.language === "scand") {
    params["with_original_language"] = "en|no|sv|da|fi|is";
  }

  if (r.exclude) {
    const existing = params["without_genres"];
    params["without_genres"] = existing ? `${existing},${r.exclude}` : r.exclude;
  }

  // Tempo overrides runtime when both are set (more intentional axis).
  applyTempo(params, r.tempo);
  applyEra(params, r.era);
  mergeExtraKeywords(params, r.extraKeywords);
}
