import { NextRequest } from "next/server";

describe("GET /api/movies/discover", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // Keys inherited from Object.prototype are client input, not moods: they
  // must be a 400 and never reach mood_history or TMDB.
  it.each(["constructor", "__proto__"])(
    "rejects the inherited key %s with a 400",
    async (key) => {
      const recordMoodPicks = vi.fn().mockResolvedValue(0);
      vi.doMock("@/lib/supabase-server", () => ({
        getSupabaseAdmin: () => ({}),
        getAuthUser: async () => ({ id: "user-1" }),
      }));
      vi.doMock("@/lib/mood-history", () => ({ recordMoodPicks }));
      const fetchSpy = vi.spyOn(global, "fetch");

      const { GET } = await import("@/app/api/movies/discover/route");
      const res = await GET(
        new NextRequest(`http://localhost/api/movies/discover?mood=${key}`),
      );

      expect(res.status).toBe(400);
      expect(recordMoodPicks).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );
});
