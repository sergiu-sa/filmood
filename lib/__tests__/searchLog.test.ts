import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase } from "./helpers/supabase-mock";
import { parseSource, recordSearchEvent, SEARCH_SOURCES, type SearchEvent } from "@/lib/searchLog";

const event: SearchEvent = {
  moods: ["laugh", "dark"],
  filters: { era: "classic" },
  hasText: true,
  source: "tile",
  resultCount: 7,
  relaxed: 1,
  partial: false,
  suggestionsShown: true,
};

describe("parseSource", () => {
  it.each(SEARCH_SOURCES)("accepts %s", (source) => {
    expect(parseSource(source)).toBe(source);
  });

  it.each([null, "", "TILE", "newsletter", "tile "])("turns %j into direct", (raw) => {
    expect(parseSource(raw)).toBe("direct");
  });
});

describe("recordSearchEvent", () => {
  it("inserts one row whose columns match search_events exactly", async () => {
    const supabase = createMockSupabase([{ error: null }]);
    await recordSearchEvent(supabase as unknown as SupabaseClient, event);

    expect(supabase.from).toHaveBeenCalledWith("search_events");
    const chain = supabase.from.mock.results[0].value as { insert: ReturnType<typeof vi.fn> };
    const row = chain.insert.mock.calls[0][0];
    // No user id and no free text: the table is anonymous by design.
    expect(Object.keys(row).sort()).toEqual(
      [
        "filters",
        "has_text",
        "moods",
        "partial",
        "relaxed",
        "result_count",
        "source",
        "suggestions_shown",
      ],
    );
    expect(row).toEqual({
      moods: ["laugh", "dark"],
      filters: { era: "classic" },
      has_text: true,
      source: "tile",
      result_count: 7,
      relaxed: 1,
      partial: false,
      suggestions_shown: true,
    });
  });

  it("rejects when the insert fails", async () => {
    const supabase = createMockSupabase([{ error: { message: "relation does not exist" } }]);
    await expect(
      recordSearchEvent(supabase as unknown as SupabaseClient, event),
    ).rejects.toMatchObject({ message: "relation does not exist" });
  });
});
