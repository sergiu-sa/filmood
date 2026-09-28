import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeMoodKey, normalizeMoodKeys } from "@/lib/moodMap";

/**
 * Record one or more mood picks for an authenticated user. Keys are
 * normalised against `moodMap` before insert (retired keys become the mood
 * that absorbed them, unknown ones are dropped) — defense in depth against
 * upstream validation drift. Duplicates within the same call collapse to one
 * row so spamming the same mood via tile-plus-text doesn't bloat the table.
 *
 * Intended to be called fire-and-forget from route handlers:
 *
 *   recordMoodPicks(supabase, user.id, moodKeys).catch((err) =>
 *     console.error("mood_history insert failed", err),
 *   );
 *
 * Returns the number of rows written (0 when nothing was valid).
 */
export async function recordMoodPicks(
  supabase: SupabaseClient,
  userId: string,
  moodKeys: string[],
): Promise<number> {
  const rows = normalizeMoodKeys(moodKeys).map((mood) => ({ user_id: userId, mood }));

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("mood_history").insert(rows);
  if (error) throw error;
  return rows.length;
}

/**
 * Pick counts per current mood key, most-picked first. Rows with a retired
 * key count towards the mood that absorbed it; unknown keys are skipped.
 */
export function countMoodPicks(rows: { mood: string }[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = normalizeMoodKey(row.mood);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}
