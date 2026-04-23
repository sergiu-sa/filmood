import type { SupabaseClient } from "@supabase/supabase-js";
import { moodMap } from "@/lib/moodMap";

/**
 * Record one or more mood picks for an authenticated user. Keys are
 * re-validated against `moodMap` before insert — defense in depth against
 * upstream validation drift. Duplicate keys within the same call are
 * deduplicated so spamming the same mood via tile-plus-text doesn't bloat
 * the table.
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
  const seen = new Set<string>();
  const rows: { user_id: string; mood: string }[] = [];
  for (const key of moodKeys) {
    if (!key || seen.has(key)) continue;
    if (!(key in moodMap)) continue;
    seen.add(key);
    rows.push({ user_id: userId, mood: key });
  }

  if (rows.length === 0) return 0;

  const { error } = await supabase.from("mood_history").insert(rows);
  if (error) throw error;
  return rows.length;
}
