import { NextRequest } from "next/server";
import { TMDBError } from "@/lib/tmdb-fetch";
import type { DiscoverResponse } from "@/lib/types";

type Params = Record<string, string>;

const rawFilm = (id: number) => ({
  id,
  title: `Film ${id}`,
  poster_path: null,
  release_date: "2020-01-01",
  vote_average: 7,
  vote_count: 900,
  overview: "",
  genre_ids: [35],
  // TMDB extras the projection must drop.
  popularity: 12.3,
  adult: false,
});

const fullPage = (from = 1) => ({
  results: Array.from({ length: 20 }, (_, i) => rawFilm(from + i)),
  total_results: 400,
  total_pages: 20,
});

interface Setup {
  user?: { id: string } | null;
  tmdb?: (params: Params) => unknown;
  recordSearchEvent?: ReturnType<typeof vi.fn>;
  getSupabaseAdmin?: () => unknown;
}

async function setup({
  user = null,
  tmdb = () => fullPage(),
  recordSearchEvent = vi.fn().mockResolvedValue(undefined),
  getSupabaseAdmin = () => ({}),
}: Setup = {}) {
  const recordMoodPicks = vi.fn().mockResolvedValue(1);
  // Next runs after() callbacks once the response is sent; tests run them by hand.
  const afterCallbacks: (() => unknown)[] = [];
  vi.doMock("next/server", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/server")>()),
    after: (callback: () => unknown) => {
      afterCallbacks.push(callback);
    },
  }));
  const flushAfter = async () => {
    for (const callback of afterCallbacks.splice(0)) await callback();
  };
  const tmdbJson = vi.fn(async (_path: string, params: Params = {}) => {
    const body = tmdb(params);
    if (body instanceof Error) throw body;
    return body;
  });
  vi.doMock("@/lib/supabase-server", () => ({
    getSupabaseAdmin,
    getAuthUser: async () => user,
  }));
  vi.doMock("@/lib/mood-history", () => ({ recordMoodPicks }));
  vi.doMock("@/lib/searchLog", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/searchLog")>()),
    recordSearchEvent,
  }));
  vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
    tmdbJson,
  }));
  const { GET } = await import("@/app/api/movies/discover/route");
  const request = (query: string) =>
    GET(new NextRequest(`http://localhost/api/movies/discover?${query}`));
  const get = async (query: string) => {
    const res = await request(query);
    await flushAfter();
    return { status: res.status, body: await res.json() };
  };
  return { get, request, flushAfter, tmdbJson, recordMoodPicks, recordSearchEvent };
}

const sentParams = (tmdbJson: ReturnType<typeof vi.fn>) =>
  tmdbJson.mock.calls.map(([, params]) => params as Params);

describe("GET /api/movies/discover", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  // Keys inherited from Object.prototype are client input, not moods: they
  // must be a 400 and never reach mood_history or TMDB.
  it.each(["constructor", "__proto__"])("rejects the inherited key %s with a 400", async (key) => {
    const { get, tmdbJson, recordMoodPicks } = await setup({ user: { id: "user-1" } });
    const { status } = await get(`mood=${key}`);

    expect(status).toBe(400);
    expect(recordMoodPicks).not.toHaveBeenCalled();
    expect(tmdbJson).not.toHaveBeenCalled();
  });

  it("asks for a mood when there is none", async () => {
    const { get } = await setup();
    expect(await get("")).toEqual({
      status: 400,
      body: { error: "Provide a mood tile or describe your mood" },
    });
  });

  it("asks for a feeling word when the text only set an era", async () => {
    const { get, recordSearchEvent } = await setup();
    const { status, body } = await get("text=80s");
    expect(status).toBe(400);
    expect(body.error).toMatch(/add a feeling word/i);
    expect(recordSearchEvent).not.toHaveBeenCalled();
  });

  // Shared links and history still carry retired keys.
  it("resolves the retired key beautiful to cry", async () => {
    const { get, tmdbJson, recordMoodPicks } = await setup({ user: { id: "user-1" } });
    const { status, body } = await get("mood=beautiful");

    expect(status).toBe(200);
    expect(body.moods).toEqual([{ key: "cry", label: "Need to let it out", accent: "blue" }]);
    expect(recordMoodPicks).toHaveBeenCalledWith({}, "user-1", ["cry"]);
    expect(sentParams(tmdbJson)[0]).toMatchObject({ with_genres: "18" });
  });

  it("keeps two moods, tiles first, and reports the text moods it dropped", async () => {
    const { get, tmdbJson, recordMoodPicks } = await setup({ user: { id: "user-1" } });
    const { body } = await get("mood=laugh,cry&text=scary");

    expect(body.moods.map((m: { key: string }) => m.key)).toEqual(["laugh", "cry"]);
    expect(body.interpreted).toMatchObject({ moods: ["unsettled"], droppedMoods: ["unsettled"] });
    expect(recordMoodPicks).toHaveBeenCalledWith({}, "user-1", ["laugh", "cry"]);
    // unsettled's genres never reach TMDB.
    expect(sentParams(tmdbJson).some((p) => p.with_genres?.includes("9648"))).toBe(false);
  });

  it("drops a third tile", async () => {
    const { get, tmdbJson } = await setup();
    const { body } = await get("mood=laugh,cry,dark");
    expect(body.moods).toHaveLength(2);
    expect(sentParams(tmdbJson).some((p) => p.with_genres === "80")).toBe(false);
  });

  // The input's maxLength is not a security boundary.
  it("caps the text at 120 characters", async () => {
    const { get } = await setup();
    const { body } = await get(`text=${encodeURIComponent(`funny ${"x".repeat(200)} scary`)}`);

    expect(body.interpreted.text).toHaveLength(120);
    expect(body.interpreted.moods).toEqual(["laugh"]);
  });

  it("echoes how the text was read", async () => {
    const { get } = await setup();
    const { body } = await get("text=cozy%2080s%20dragons");
    expect(body.interpreted).toEqual({
      text: "cozy 80s dragons",
      moods: ["easy"],
      era: "classic",
      tempo: null,
      unmatched: ["dragons"],
      droppedMoods: [],
    });
  });

  it("returns the discover contract with projected films", async () => {
    const { get } = await setup();
    const { status, body } = await get("mood=laugh&seed=5");

    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["films", "interpreted", "moods", "partial", "relatedMoods", "relaxed", "seed", "suggestions"],
    );
    expect(body).toMatchObject({
      seed: 5,
      relaxed: 0,
      partial: false,
      interpreted: null,
      suggestions: [],
      relatedMoods: [],
    } satisfies Partial<DiscoverResponse>);
    expect(Object.keys(body.films[0]).sort()).toEqual(
      ["genre_ids", "id", "moodKeys", "overview", "poster_path", "release_date", "title", "vote_average", "vote_count"],
    );
    expect(body.films[0].moodKeys).toEqual(["laugh"]);
  });

  it("orders films the same way for the same seed", async () => {
    const { get } = await setup({ tmdb: (p) => fullPage(p.page === "1" ? 1 : Number(p.page) * 100) });
    const order = async (seed: number) =>
      (await get(`mood=laugh,thrilling&seed=${seed}`)).body.films.map((f: { id: number }) => f.id);

    expect(await order(77)).toEqual(await order(77));
    expect(await order(77)).not.toEqual(await order(78));
  });

  it.each(["", "seed=abc", "seed=0", "seed=2147483647"])("returns a fresh valid seed for %j", async (query) => {
    const { get } = await setup();
    const { body } = await get(`mood=laugh&${query}`);
    expect(Number.isInteger(body.seed)).toBe(true);
    expect(body.seed).toBeGreaterThanOrEqual(1);
    expect(body.seed).toBeLessThanOrEqual(2147483646);
  });

  it("turns a TMDB 401 into a 500 with a safe message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { get } = await setup({ tmdb: () => new TMDBError(401, "/discover/movie") });
    expect(await get("mood=laugh")).toEqual({ status: 500, body: { error: "Failed to fetch films" } });
  });

  // Picking family means kids are watching, so the other mood's pool is capped too.
  it("keeps the family cap on both pools", async () => {
    const { get, tmdbJson } = await setup();
    await get("mood=family,dark");

    expect(sentParams(tmdbJson).some((p) => p.with_genres === "80")).toBe(true);
    for (const params of sentParams(tmdbJson)) {
      expect(params).toMatchObject({
        certification_country: "US",
        "certification.gte": "G",
        "certification.lte": "PG",
      });
    }
  });

  it("logs one anonymous search event", async () => {
    const { get, recordSearchEvent } = await setup({ user: { id: "user-1" } });
    await get("mood=laugh&era=classic&runtime=forever&text=funny%20secret%20plans&src=tile");

    expect(recordSearchEvent).toHaveBeenCalledTimes(1);
    const [, event] = recordSearchEvent.mock.calls[0];
    expect(event).toEqual({
      moods: ["laugh"],
      filters: { era: "classic" },
      hasText: true,
      source: "tile",
      resultCount: 20,
      relaxed: 0,
      partial: false,
      suggestionsShown: false,
    });
    expect(JSON.stringify(event)).not.toMatch(/user-1|secret|forever/);
  });

  it("writes mood history and the search log only after the response", async () => {
    const { request, flushAfter, recordMoodPicks, recordSearchEvent } = await setup({
      user: { id: "user-1" },
    });
    const res = await request("mood=laugh");

    expect(res.status).toBe(200);
    expect(recordMoodPicks).not.toHaveBeenCalled();
    expect(recordSearchEvent).not.toHaveBeenCalled();
    await flushAfter();
    expect(recordMoodPicks).toHaveBeenCalledTimes(1);
    expect(recordSearchEvent).toHaveBeenCalledTimes(1);
  });

  // A thin result's suggestion buttons delete the URL param, so an era read
  // from the text must not be offered: there's nothing to delete.
  describe("suggestions", () => {
    const thinWithEra = (p: Params) =>
      p["primary_release_date.lte"]
        ? { results: [rawFilm(1)], total_results: 1, total_pages: 1 }
        : fullPage();

    it("offers to remove an era set in the URL", async () => {
      const { get } = await setup({ tmdb: thinWithEra });
      const { body } = await get("mood=laugh&era=classic");
      expect(body.suggestions).toEqual([{ remove: "era", total: 400 }]);
    });

    it("does not offer to remove an era read from the text", async () => {
      const { get, tmdbJson } = await setup({ tmdb: thinWithEra });
      const { body } = await get("text=cozy%2080s%20heist");

      expect(body.interpreted.era).toBe("classic");
      expect(body.films.length).toBeLessThan(12);
      expect(body.suggestions).toEqual([]);
      // And no probe was spent on it.
      for (const params of sentParams(tmdbJson)) {
        expect(params["primary_release_date.lte"]).toBe("1989-12-31");
      }
    });
  });

  it("logs an unknown src as direct", async () => {
    const { get, recordSearchEvent } = await setup();
    await get("mood=laugh&src=newsletter");
    expect(recordSearchEvent.mock.calls[0][1].source).toBe("direct");
  });

  it("answers the same when the log insert fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await (await setup()).get("mood=laugh&seed=9");
    vi.resetModules();
    const failing = await setup({ recordSearchEvent: vi.fn().mockRejectedValue(new Error("no table")) });
    expect(await failing.get("mood=laugh&seed=9")).toEqual(ok);
  });

  it("answers the same when the admin client can't be created", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const ok = await (await setup()).get("mood=laugh&seed=9");
    vi.resetModules();
    const broken = await setup({
      getSupabaseAdmin: () => {
        throw new Error("Missing Supabase env vars");
      },
    });
    expect(await broken.get("mood=laugh&seed=9")).toEqual(ok);
  });
});
