// One anonymous row per mood search, so the zero-result rate can be measured.
// Server-only: it writes with the service-role client.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Where the search came from; the client adds `src` when it navigates. */
export const SEARCH_SOURCES = ["direct", "tile", "text", "suggestion", "related", "shuffle", "filter"] as const;
export type SearchSource = (typeof SEARCH_SOURCES)[number];

export function parseSource(raw: string | null): SearchSource {
  return SEARCH_SOURCES.find((s) => s === raw) ?? "direct";
}

/**
 * Deliberately has no field for a user id or the free text: `search_events`
 * holds no personal data, and this type is what keeps it that way.
 */
export interface SearchEvent {
  moods: string[];
  /** Applied filter values only, all from allow-lists. */
  filters: Record<string, string>;
  hasText: boolean;
  source: SearchSource;
  resultCount: number;
  relaxed: 0 | 1 | 2;
  partial: boolean;
  suggestionsShown: boolean;
}

export async function recordSearchEvent(supabase: SupabaseClient, e: SearchEvent): Promise<void> {
  const { error } = await supabase.from("search_events").insert({
    moods: e.moods,
    filters: e.filters,
    has_text: e.hasText,
    source: e.source,
    result_count: e.resultCount,
    relaxed: e.relaxed,
    partial: e.partial,
    suggestions_shown: e.suggestionsShown,
  });
  if (error) throw error;
}
