// The user-chosen filters layered on top of a mood's TMDB query. Pure, so the
// discover route and scripts/check-moods.ts build the exact same query.

import {
  applyEra,
  applyTempo,
  mergeExtraKeywords,
  isEraKey,
  isTempoKey,
  EXCLUSION_OPTIONS,
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

/** The filters a user set and can take back off. extraKeywords come from the text, so they're not one. */
export type RefinementKey = "era" | "tempo" | "runtime" | "language" | "exclude";

const REFINEMENT_KEYS: RefinementKey[] = ["era", "tempo", "runtime", "language", "exclude"];

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
  const excludeParam = sp.get("exclude") ?? "";
  // Rebuilt from the offered genres, never forwarded raw: malformed input would
  // 400 at TMDB, and a free-form list would make every request a cache miss.
  const excludeIds = /^\d+(,\d+)*$/.test(excludeParam)
    ? new Set(excludeParam.split(",").map(Number))
    : new Set<number>();
  const exclude = EXCLUSION_OPTIONS.filter((o) => excludeIds.has(o.id)).map((o) => o.id);
  const runtime = sp.get("runtime");
  const language = sp.get("language");
  return {
    runtime: runtime === "short" || runtime === "long" ? runtime : null,
    language: language === "en" || language === "scand" ? language : null,
    exclude: exclude.length ? exclude.join(",") : null,
    era: isEraKey(eraParam) ? eraParam : resolved?.era ?? null,
    tempo: isTempoKey(tempoParam) ? tempoParam : resolved?.tempo ?? null,
    extraKeywords: resolved?.keywords ?? [],
  };
}

export function activeRefinementKeys(r: Refinements): RefinementKey[] {
  return REFINEMENT_KEYS.filter((key) => r[key] !== null);
}

/**
 * The active filters that deleting their URL param clears. The free text can
 * imply an era or tempo, which has no param to delete or comes straight back.
 */
export function removableRefinementKeys(
  sp: URLSearchParams,
  resolved: ResolvedMoodText | null,
): RefinementKey[] {
  return activeRefinementKeys(parseRefinements(sp, resolved)).filter((key) => {
    const without = new URLSearchParams(sp);
    without.delete(key);
    return parseRefinements(without, resolved)[key] === null;
  });
}

export function withoutRefinement(r: Refinements, key: RefinementKey): Refinements {
  return { ...r, [key]: null };
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
