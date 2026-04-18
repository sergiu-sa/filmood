// Shared helpers for applying the era/tempo/extra-keyword refinements
// to a TMDB discover URL. Used by both the single-session route and lib/deck.ts
// so the mapping stays in one place.

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

export function applyEra(url: URL, era: EraKey | null) {
  if (!era) return;
  if (era === "classic") {
    url.searchParams.set("primary_release_date.lte", "1989-12-31");
  } else if (era === "modern") {
    url.searchParams.set("primary_release_date.gte", "1990-01-01");
    url.searchParams.set("primary_release_date.lte", "2009-12-31");
  } else if (era === "fresh") {
    url.searchParams.set("primary_release_date.gte", "2010-01-01");
  }
}

// Tempo overrides the older `runtime` refinement when both are present —
// it's the more intentional axis.
export function applyTempo(url: URL, tempo: TempoKey | null) {
  if (!tempo) return;
  if (tempo === "slowburn") {
    url.searchParams.delete("with_runtime.lte");
    url.searchParams.set("with_runtime.gte", "120");
  } else if (tempo === "fastpaced") {
    url.searchParams.delete("with_runtime.gte");
    url.searchParams.set("with_runtime.lte", "110");
  }
}

export function appendExtraKeywords(url: URL, extra: number[]) {
  if (!extra.length) return;
  // Dedupe: the mood's own with_keywords and the resolver's text-derived
  // keywords can legitimately overlap (e.g. "feel good" resolves to both
  // the `easy` mood and keyword 6054). Duplicates don't break TMDB but
  // pollute the query string.
  const existing = url.searchParams.get("with_keywords");
  const merged = new Set<string>();
  if (existing) existing.split(",").forEach((k) => merged.add(k));
  extra.forEach((k) => merged.add(String(k)));
  url.searchParams.set("with_keywords", [...merged].join(","));
}
