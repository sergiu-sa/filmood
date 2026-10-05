// The user's filters on top of a mood's TMDB query: Time, Era and Where. Pure,
// so the discover route, the group deck, check-moods and the results page all
// read and apply them the same way.

import type { ResolvedMoodText } from "@/lib/moodResolver";
import type { AppliedFilters, EraKey, TempoKey, TimeKey, WhereKey } from "@/lib/types";

export interface Filters extends AppliedFilters {
  /** Read from the free text, not set by the user: never probed or offered. */
  extraKeywords: number[];
  /** TMDB provider ids for `where: "mine"`, set only by `resolveWhere` (lib/watchProviders.ts). */
  providers: number[];
}

export type FilterKey = keyof AppliedFilters;

const FILTER_KEYS: FilterKey[] = ["time", "era", "where"];

/** `label` for sheets, suggestions and sentences; `short` for the results bar and its mobile chips. */
export const TIME_OPTIONS: { value: TimeKey; label: string; short: string; hint: string; gte?: number; lte?: number }[] = [
  { value: "short", label: "Under 100 min", short: "Under 100 min", hint: "a quick one", lte: 100 },
  { value: "medium", label: "Under 2 hours", short: "Under 2 h", hint: "a normal night", lte: 120 },
  { value: "long", label: "Long & immersive", short: "Long", hint: "2 h 20+", gte: 140 },
];

export const ERA_OPTIONS: { value: EraKey; label: string; short: string; gte?: string; lte?: string }[] = [
  { value: "classic", label: "Before 1990", short: "Before 1990", lte: "1989-12-31" },
  { value: "modern", label: "1990–2009", short: "1990–2009", gte: "1990-01-01", lte: "2009-12-31" },
  { value: "fresh", label: "2010 onwards", short: "2010 on", gte: "2010-01-01" },
];

export const WHERE_OPTIONS: { value: WhereKey; label: string; short: string }[] = [
  { value: "mine", label: "My services", short: "My services" },
  { value: "norway", label: "Streaming in Norway", short: "Norway streaming" },
  { value: "any", label: "Anywhere", short: "Anywhere" },
];

/** What each filter reads when it's off; suggestion buttons use the same words. */
export const ANY_LABELS: Record<FilterKey, string> = { time: "Any length", era: "Any era", where: "Anywhere" };

/** Segmented-control options: the results bar, and the group page from 900px. */
export const SHORT_OPTIONS = {
  time: [{ value: null, label: "Any" }, ...TIME_OPTIONS.map((o) => ({ value: o.value, label: o.short }))],
  era: [{ value: null, label: "Any" }, ...ERA_OPTIONS.map((o) => ({ value: o.value, label: o.short }))],
  where: WHERE_OPTIONS.map((o) => ({ value: o.value, label: o.short })),
};

/** Vertical-row options with hints: the results page's sheets, and the group page below 900px. */
export const LONG_OPTIONS = {
  time: [
    { value: null, label: ANY_LABELS.time },
    ...TIME_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
  ],
  era: [{ value: null, label: ANY_LABELS.era }, ...ERA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))],
  where: WHERE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
};

export const EMPTY_FILTERS: Filters = {
  time: null,
  era: null,
  where: "norway",
  extraKeywords: [],
  providers: [],
};

export function isTimeKey(v: string | null | undefined): v is TimeKey {
  return TIME_OPTIONS.some((o) => o.value === v);
}

export function isEraKey(v: string | null | undefined): v is EraKey {
  return ERA_OPTIONS.some((o) => o.value === v);
}

export function isWhereKey(v: string | null | undefined): v is WhereKey {
  return WHERE_OPTIONS.some((o) => o.value === v);
}

/** Old shared links and the group flow's stored tempo. Goes with the last tempo reader. */
export const LEGACY_TEMPO_TIME: Record<TempoKey, TimeKey> = { slowburn: "long", fastpaced: "short" };

export function isTempoKey(v: string | null | undefined): v is TempoKey {
  return v === "slowburn" || v === "fastpaced";
}

/** Every URL param that sets a filter, so clearing one leaves no alias behind. */
const FILTER_PARAMS: Record<FilterKey, string[]> = {
  time: ["time", "tempo", "runtime"],
  era: ["era"],
  where: ["where", "services"],
};

/** `time=any` / `era=any`: the user cleared a filter the free text set. */
const ANY = "any";

function timeFromParams(sp: URLSearchParams): TimeKey | null {
  const time = sp.get("time");
  if (isTimeKey(time)) return time;
  const tempo = sp.get("tempo");
  if (isTempoKey(tempo)) return LEGACY_TEMPO_TIME[tempo];
  const runtime = sp.get("runtime");
  return runtime === "short" || runtime === "long" ? runtime : null;
}

/**
 * Explicit params beat the free text, `any` included; `time` beats the legacy
 * `tempo`, which beats the legacy `runtime`. The retired `language` and
 * `exclude` are ignored.
 */
export function parseFilters(sp: URLSearchParams, resolved: ResolvedMoodText | null): Filters {
  const era = sp.get("era");
  const where = sp.get("where");
  return {
    time:
      sp.get("time") === ANY
        ? null
        : timeFromParams(sp) ?? resolved?.time ?? null,
    era: era === ANY ? null : isEraKey(era) ? era : resolved?.era ?? null,
    where: isWhereKey(where) ? where : EMPTY_FILTERS.where,
    extraKeywords: resolved?.keywords ?? [],
    providers: [],
  };
}

function isActive(f: Filters, key: FilterKey): boolean {
  return key === "where" ? f.where !== "any" : f[key] !== null;
}

export function activeFilterKeys(f: Filters): FilterKey[] {
  return FILTER_KEYS.filter((key) => isActive(f, key));
}

export function withoutFilter(f: Filters, key: FilterKey): Filters {
  return key === "where" ? { ...f, where: "any", providers: [] } : { ...f, [key]: null };
}

/** The URL a suggestion navigates to. The route decides with it and the page applies it, so they agree. */
export function clearFilterParam(sp: URLSearchParams, key: FilterKey): URLSearchParams {
  const next = new URLSearchParams(sp);
  FILTER_PARAMS[key].forEach((param) => next.delete(param));
  // A missing Where is the default (My services or Norway), so deleting it wouldn't loosen anything.
  if (key === "where") next.set("where", "any");
  return next;
}

/** The URL a filter control writes: every alias of `key` removed, then `value` set (null clears Time or Era). */
export function setFilterParam(sp: URLSearchParams, key: FilterKey, value: string | null): URLSearchParams {
  const next = new URLSearchParams(sp);
  FILTER_PARAMS[key].forEach((param) => next.delete(param));
  // With text, deleting the param would let the text's Time or Era straight back.
  if (value !== null) next.set(key, value);
  else if (next.has("text")) next.set(key, ANY);
  return next;
}

/** Active filters that clearFilterParam actually loosens. A value the text implied comes straight back. */
export function removableFilterKeys(
  sp: URLSearchParams,
  resolved: ResolvedMoodText | null,
): FilterKey[] {
  return activeFilterKeys(parseFilters(sp, resolved)).filter(
    (key) => !isActive(parseFilters(clearFilterParam(sp, key), resolved), key),
  );
}

function mergeExtraKeywords(params: Record<string, string>, extra: number[]) {
  if (!extra.length) return;
  // The mood's own keywords and the text's can overlap ("feel good" is both).
  // Pipe-joined: TMDB reads "," as AND.
  const merged = new Set(params.with_keywords ? params.with_keywords.split("|") : []);
  extra.forEach((k) => merged.add(String(k)));
  params.with_keywords = [...merged].join("|");
}

export function applyFilters(params: Record<string, string>, f: Filters): void {
  const time = TIME_OPTIONS.find((o) => o.value === f.time);
  if (time?.lte) params["with_runtime.lte"] = String(time.lte);
  // Only ever raises the mood's runtime floor; one Time value means one bound.
  if (time?.gte) params["with_runtime.gte"] = String(time.gte);

  const era = ERA_OPTIONS.find((o) => o.value === f.era);
  if (era?.gte) params["primary_release_date.gte"] = era.gte;
  if (era?.lte) params["primary_release_date.lte"] = era.lte;

  if (f.where !== "any") {
    params.watch_region = "NO";
    params.with_watch_monetization_types = "flatrate";
  }
  // Pipe-joined: TMDB reads "," as AND, which would demand every service at once.
  // With no ids, "mine" is plain Norway: an empty param isn't "no limit".
  if (f.where === "mine" && f.providers.length > 0) params.with_watch_providers = f.providers.join("|");

  mergeExtraKeywords(params, f.extraKeywords);
}
