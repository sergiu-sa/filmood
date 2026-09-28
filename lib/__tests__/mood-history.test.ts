import type { SupabaseClient } from "@supabase/supabase-js";
import { recordMoodPicks } from "@/lib/mood-history";

describe("recordMoodPicks", () => {
  // An empty stub: reaching supabase.from would throw, so any row that gets
  // past validation fails the test.
  it.each(["constructor", "__proto__", "toString"])(
    "writes nothing for the inherited key %s",
    async (key) => {
      await expect(
        recordMoodPicks({} as SupabaseClient, "user-1", [key]),
      ).resolves.toBe(0);
    },
  );
});
