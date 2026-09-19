// Shared helpers for applying the era/tempo/extra-keyword refinements to a
// TMDB discover query. Used by both the single-session route and lib/deck.ts
// so the mapping stays in one place.
//
// They mutate a plain param record — the same shape buildTMDBParams returns
// and tmdbJson accepts — so nothing has to be converted on the way through.

import type { EraKey, TempoKey } from "@/lib/types";

export const ERA_OPTIONS: { value: EraKey; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "modern", label: "Modern" },
  { value: "fresh", label: "Fresh" },
];

export const TEMPO_OPTIONS: { value: TempoKey; label: string }[] = [
  { value: "slowburn", label: "Slow-burn" },
  { value: "fastpaced", label: "Fast-paced" },
];

export function isEraKey(v: string | null | undefined): v is EraKey {
  return v === "classic" || v === "modern" || v === "fresh";
}

export function isTempoKey(v: string | null | undefined): v is TempoKey {
  return v === "slowburn" || v === "fastpaced";
}

export function applyEra(params: Record<string, string>, era: EraKey | null) {
  if (!era) return;
  if (era === "classic") {
    params["primary_release_date.lte"] = "1989-12-31";
  } else if (era === "modern") {
    params["primary_release_date.gte"] = "1990-01-01";
    params["primary_release_date.lte"] = "2009-12-31";
  } else if (era === "fresh") {
    params["primary_release_date.gte"] = "2010-01-01";
  }
}

// Tempo overrides the older `runtime` refinement when both are present —
// it's the more intentional axis.
export function applyTempo(params: Record<string, string>, tempo: TempoKey | null) {
  if (!tempo) return;
  if (tempo === "slowburn") {
    delete params["with_runtime.lte"];
    params["with_runtime.gte"] = "120";
  } else if (tempo === "fastpaced") {
    delete params["with_runtime.gte"];
    params["with_runtime.lte"] = "110";
  }
}

export function mergeExtraKeywords(
  params: Record<string, string>,
  extra: number[],
) {
  if (!extra.length) return;
  // Dedupe: the mood's own with_keywords and the resolver's text-derived
  // keywords can legitimately overlap (e.g. "feel good" resolves to both
  // the `easy` mood and keyword 6054). Duplicates don't break TMDB but
  // pollute the query string.
  const existing = params["with_keywords"];
  const merged = new Set<string>();
  if (existing) existing.split(",").forEach((k) => merged.add(k));
  extra.forEach((k) => merged.add(String(k)));
  params["with_keywords"] = [...merged].join(",");
}
