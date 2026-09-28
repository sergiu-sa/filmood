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

  // Shared links and history still carry retired keys.
  it("resolves the retired key beautiful to cry", async () => {
    const recordMoodPicks = vi.fn().mockResolvedValue(1);
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: () => ({}),
      getAuthUser: async () => ({ id: "user-1" }),
    }));
    vi.doMock("@/lib/mood-history", () => ({ recordMoodPicks }));
    const tmdbJson = vi.fn().mockResolvedValue({ results: [{ id: 1 }] });
    vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
      tmdbJson,
    }));

    const { GET } = await import("@/app/api/movies/discover/route");
    const res = await GET(
      new NextRequest("http://localhost/api/movies/discover?mood=beautiful"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.mood).toBe("cry");
    expect(recordMoodPicks).toHaveBeenCalledWith({}, "user-1", ["cry"]);
    expect(tmdbJson.mock.calls[0][1]).toMatchObject({ with_genres: "18" });
  });

  // Picking family means kids are watching, so the per-mood top-up that runs
  // when the merged pool is thin must not bring back the other mood's R films.
  it("keeps the family cap on the fallback pools", async () => {
    vi.doMock("@/lib/supabase-server", () => ({
      getSupabaseAdmin: () => ({}),
      getAuthUser: async () => null,
    }));
    const tmdbJson = vi.fn().mockResolvedValue({ results: [{ id: 1 }] });
    vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
      tmdbJson,
    }));

    const { GET } = await import("@/app/api/movies/discover/route");
    const res = await GET(
      new NextRequest("http://localhost/api/movies/discover?mood=family,dark"),
    );

    expect(res.status).toBe(200);
    // 2 merged pages + 2 pages for each of the two fallback pools.
    expect(tmdbJson).toHaveBeenCalledTimes(6);
    for (const [, params] of tmdbJson.mock.calls) {
      expect(params).toMatchObject({
        certification_country: "US",
        "certification.gte": "G",
        "certification.lte": "PG",
      });
    }
  });
});

