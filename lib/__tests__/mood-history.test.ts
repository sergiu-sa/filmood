import type { SupabaseClient } from "@supabase/supabase-js";
import { countMoodPicks, recordMoodPicks } from "@/lib/mood-history";
import { createMockSupabase } from "./helpers/supabase-mock";

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

  it.each([[["beautiful"]], [["cry", "beautiful"]]])(
    "stores %j as a single cry row",
    async (keys) => {
      const supabase = createMockSupabase([{ error: null }]);
      const written = await recordMoodPicks(
        supabase as unknown as SupabaseClient,
        "user-1",
        keys,
      );
      expect(written).toBe(1);
      const insert = supabase.from.mock.results[0].value.insert;
      expect(insert).toHaveBeenCalledWith([{ user_id: "user-1", mood: "cry" }]);
    },
  );
});

describe("countMoodPicks", () => {
  it("folds retired keys into their mood and skips unknown ones", () => {
    const rows = ["beautiful", "weird", "cry", "thoughtful", "bogus", "laugh", "cry"].map(
      (mood) => ({ mood }),
    );
    expect(countMoodPicks(rows)).toEqual([
      ["cry", 3],
      ["mindbending", 2],
      ["laugh", 1],
    ]);
  });
});
