import { NextRequest } from "next/server";
import { TMDBError } from "@/lib/tmdb-fetch";
import type { DiscoverResponse } from "@/lib/types";
import { createMockSupabase } from "@/lib/__tests__/helpers/supabase-mock";

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

const PROVIDERS_PATH = "/watch/providers/movie";

const FEELING_WORD = "Add a feeling word — like 'funny', 'dark', or 'cozy'. A length or an era alone isn't enough.";

// TMDB's Norway provider list, as lib/watchProviders.ts reads it.
const providerList = {
  results: [
    { provider_id: 8, provider_name: "Netflix" },
    { provider_id: 76, provider_name: "Viaplay" },
    { provider_id: 1899, provider_name: "HBO Max" },
    { provider_id: 431, provider_name: "TV 2 Play" },
    { provider_id: 337, provider_name: "Disney Plus" },
    { provider_id: 119, provider_name: "Amazon Prime Video" },
  ],
};

interface Setup {
  user?: { id: string } | null;
  tmdb?: (params: Params, path: string) => unknown;
  recordSearchEvent?: ReturnType<typeof vi.fn>;
  getSupabaseAdmin?: () => unknown;
  authFails?: boolean;
}

async function setup({
  user = null,
  tmdb = (_params, path) => (path === PROVIDERS_PATH ? providerList : fullPage()),
  recordSearchEvent = vi.fn().mockResolvedValue(undefined),
  // No saved services: a signed-in search with no Where reads them.
  getSupabaseAdmin = withSaved(null),
  authFails = false,
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
  const tmdbJson = vi.fn(async (path: string, params: Params = {}) => {
    const body = tmdb(params, path);
    if (body instanceof Error) throw body;
    return body;
  });
  vi.doMock("@/lib/supabase-server", () => ({
    getSupabaseAdmin,
    getAuthUser: async () => {
      if (authFails) throw new Error("auth server down");
      return user;
    },
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
  tmdbJson.mock.calls.filter(([path]) => path === "/discover/movie").map(([, params]) => params as Params);

const providerListCalls = (tmdbJson: ReturnType<typeof vi.fn>) =>
  tmdbJson.mock.calls.filter(([path]) => path === PROVIDERS_PATH).length;

/** A signed-in user's streaming_preferences row, as savedServices reads it. */
const withSaved = (platforms: string[] | null, error: unknown = null) => {
  const supabase = createMockSupabase([{ data: platforms ? { platforms } : null, error }]);
  return () => supabase;
};

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
    expect(body.error).toBe(FEELING_WORD);
    expect(recordSearchEvent).not.toHaveBeenCalled();
  });

  it("asks for a feeling word when the text only set a length", async () => {
    const { get } = await setup();
    expect(await get("text=slow")).toEqual({ status: 400, body: { error: FEELING_WORD } });
  });

  // Shared links and history still carry retired keys.
  it("resolves the retired key beautiful to cry", async () => {
    const admin = withSaved(null);
    const { get, tmdbJson, recordMoodPicks } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: admin });
    const { status, body } = await get("mood=beautiful");

    expect(status).toBe(200);
    expect(body.moods).toEqual([{ key: "cry", label: "Need to let it out", accent: "blue" }]);
    expect(recordMoodPicks).toHaveBeenCalledWith(admin(), "user-1", ["cry"]);
    expect(sentParams(tmdbJson)[0]).toMatchObject({ with_genres: "18" });
  });

  it("keeps two moods, tiles first, and reports the text moods it dropped", async () => {
    const admin = withSaved(null);
    const { get, tmdbJson, recordMoodPicks } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: admin });
    const { body } = await get("mood=laugh,cry&text=scary");

    expect(body.moods.map((m: { key: string }) => m.key)).toEqual(["laugh", "cry"]);
    expect(body.droppedMoods).toEqual(["unsettled"]);
    expect(body.interpreted).toMatchObject({ moods: ["unsettled"] });
    expect(body.interpreted).not.toHaveProperty("droppedMoods");
    expect(recordMoodPicks).toHaveBeenCalledWith(admin(), "user-1", ["laugh", "cry"]);
    // unsettled's genres never reach TMDB.
    expect(sentParams(tmdbJson).some((p) => p.with_genres?.includes("9648"))).toBe(false);
  });

  // Without text there's no interpreted block, so the dropped mood has to be reported beside moods.
  it("drops a third tile and says which", async () => {
    const { get, tmdbJson } = await setup();
    const { body } = await get("mood=laugh,cry,dark");
    expect(body.moods).toHaveLength(2);
    expect(body.droppedMoods).toEqual(["dark"]);
    expect(body.interpreted).toBeNull();
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
      time: null,
      unmatched: ["dragons"],
    });
    expect(body.droppedMoods).toEqual([]);
  });

  it("echoes a Time read from the text", async () => {
    const { get } = await setup();
    const { body } = await get("text=slow%20burn%20noir");
    expect(body.interpreted).toMatchObject({ moods: ["dark"], time: "long" });
  });

  it("returns the discover contract with projected films", async () => {
    const { get } = await setup();
    const { status, body } = await get("mood=laugh&seed=5");

    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ["droppedMoods", "films", "filters", "interpreted", "moods", "partial", "relatedMoods", "relaxed", "seed", "suggestions"],
    );
    expect(body).toMatchObject({
      filters: { time: null, era: null, where: "norway" },
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
      filters: { era: "classic", where: "norway" },
      hasText: true,
      source: "tile",
      resultCount: 20,
      relaxed: 0,
      partial: false,
      suggestionsShown: false,
    });
    expect(JSON.stringify(event)).not.toMatch(/user-1|secret|forever/);
  });

  it("reports the filters it applied", async () => {
    const { get } = await setup();
    const { body } = await get("mood=laugh&tempo=slowburn&era=modern&where=any");
    expect(body.filters).toEqual({ time: "long", era: "modern", where: "any" });
  });

  // Old shared links: tempo/runtime become a Time, language/exclude are retired.
  it("reads an old shared link as Time and ignores the retired params", async () => {
    const { get, tmdbJson } = await setup();
    const { body } = await get("mood=laugh&runtime=long&language=scand&exclude=27");

    expect(body.filters).toEqual({ time: "long", era: null, where: "norway" });
    for (const params of sentParams(tmdbJson)) {
      expect(params["with_runtime.gte"]).toBe("140");
      expect(params.with_original_language).toBeUndefined();
      expect(params.without_genres).toBe("27,16");
    }
  });

  it("searches everywhere for Anywhere and in Norway otherwise", async () => {
    const anywhere = await setup();
    await anywhere.get("mood=laugh&where=any");
    for (const params of sentParams(anywhere.tmdbJson)) expect(params.watch_region).toBeUndefined();

    vi.resetModules();
    const unknown = await setup();
    const { body } = await unknown.get("mood=laugh&where=elsewhere");
    expect(body.filters.where).toBe("norway");
    for (const params of sentParams(unknown.tmdbJson)) {
      expect(params).toMatchObject({ watch_region: "NO", with_watch_monetization_types: "flatrate" });
    }
  });

  describe("My services", () => {
    it("limits a signed-in user to their saved services", async () => {
      const { get, tmdbJson } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: withSaved(["Netflix"]) });
      const { body } = await get("mood=laugh&where=mine");

      expect(body.filters.where).toBe("mine");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) {
        expect(params).toMatchObject({ with_watch_providers: "8", watch_region: "NO" });
      }
    });

    // Same set, same query, same cache entry.
    it.each(["netflix,viaplay", "viaplay,netflix"])("ORs a guest's services=%s", async (services) => {
      const { get, tmdbJson } = await setup();
      const { body } = await get(`mood=laugh&where=mine&services=${services}`);

      expect(body.filters.where).toBe("mine");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBe("8|76");
    });

    it.each(["", "&services=hulu,constructor"])("settles a guest with no known services on Norway (%s)", async (services) => {
      const { get, tmdbJson } = await setup();
      const { body } = await get(`mood=laugh&where=mine${services}`);

      expect(body.filters.where).toBe("norway");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) {
        expect(params.with_watch_providers).toBeUndefined();
        expect(params.watch_region).toBe("NO");
      }
    });

    it("prefers saved services over the param", async () => {
      const { get, tmdbJson } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: withSaved(["Netflix"]) });
      await get("mood=laugh&where=mine&services=viaplay");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBe("8");
    });

    // D4: no Where means "my default", which is My services whenever some are known.
    it("treats no Where as My services when services are known", async () => {
      const { get, tmdbJson } = await setup();
      const { body } = await get("mood=laugh&services=netflix");

      expect(body.filters.where).toBe("mine");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBe("8");
    });

    it("settles a guest with no Where and no services on Norway without the provider list", async () => {
      const { get, tmdbJson } = await setup();
      const { body } = await get("mood=laugh");

      expect(body.filters.where).toBe("norway");
      expect(providerListCalls(tmdbJson)).toBe(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBeUndefined();
    });

    it("uses a signed-in user's saved services when there's no Where", async () => {
      const { get, tmdbJson } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: withSaved(["Netflix"]) });
      const { body } = await get("mood=laugh");

      expect(body.filters.where).toBe("mine");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBe("8");
    });

    it("reads a signed-in user's preferences once and settles on Norway when none are saved", async () => {
      const admin = withSaved(null);
      const { get, tmdbJson } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: admin });
      const { body } = await get("mood=laugh");

      expect(body.filters.where).toBe("norway");
      expect(admin().from).toHaveBeenCalledTimes(1);
      expect(admin().from).toHaveBeenCalledWith("streaming_preferences");
      expect(providerListCalls(tmdbJson)).toBe(0);
    });

    it("never overrides an explicit Where", async () => {
      const admin = withSaved(["Netflix"]);
      const { get, tmdbJson } = await setup({ user: { id: "user-1" }, getSupabaseAdmin: admin });
      const { body } = await get("mood=laugh&where=norway&services=netflix");

      expect(body.filters.where).toBe("norway");
      expect(admin().from).not.toHaveBeenCalled();
      expect(providerListCalls(tmdbJson)).toBe(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBeUndefined();
    });

    it("treats an unknown Where like no Where", async () => {
      const { get, tmdbJson } = await setup();
      const { body } = await get("mood=laugh&where=elsewhere&services=netflix");

      expect(body.filters.where).toBe("mine");
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params.with_watch_providers).toBe("8");
    });

    it("logs a default that settled on My services as mine", async () => {
      const { get, recordSearchEvent } = await setup();
      await get("mood=laugh&services=netflix");
      expect(recordSearchEvent.mock.calls[0][1].filters).toEqual({ where: "mine" });
    });

    it("logs where=mine without the services", async () => {
      const { get, recordSearchEvent } = await setup();
      await get("mood=laugh&where=mine&services=netflix,viaplay");

      const [, event] = recordSearchEvent.mock.calls[0];
      expect(event.filters).toEqual({ where: "mine" });
      expect(JSON.stringify(event)).not.toMatch(/netflix|viaplay/i);
    });

    it("offers Anywhere for a thin My services search, probing without providers", async () => {
      const { get, tmdbJson } = await setup({
        tmdb: (p, path) =>
          path === PROVIDERS_PATH
            ? providerList
            : p.with_watch_providers
              ? { results: [rawFilm(1)], total_results: 1, total_pages: 1 }
              : fullPage(),
      });
      const { body } = await get("mood=laugh&where=mine&services=netflix");

      expect(body.suggestions).toEqual([{ remove: "where", total: 400 }]);
      const probes = sentParams(tmdbJson).filter((p) => !p.with_watch_providers);
      expect(probes).toHaveLength(1);
      expect(probes[0].watch_region).toBeUndefined();
    });

    // Failures surface: a broken read never quietly becomes Norway.
    it.each([
      ["a database error", { user: { id: "user-1" }, getSupabaseAdmin: withSaved(null, { message: "permission denied" }) }],
      [
        "a provider-list failure",
        { tmdb: (_p: Params, path: string) => (path === PROVIDERS_PATH ? new TMDBError(401, path) : fullPage()) },
      ],
    ])("turns %s into a 500 with a safe message", async (_label, options) => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { get } = await setup(options);
      expect(await get("mood=laugh&where=mine&services=viaplay")).toEqual({
        status: 500,
        body: { error: "Failed to fetch films" },
      });
    });
  });

  it("turns a failed sign-in check into a 500 with a body", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { get, tmdbJson } = await setup({ authFails: true });
    const { status, body } = await get("mood=laugh");

    expect(status).toBe(500);
    expect(typeof body.error).toBe("string");
    expect(tmdbJson).not.toHaveBeenCalled();
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

  // A suggestion's button applies clearFilterParam, so a filter read from the
  // text must not be offered: there's no param to clear.
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

    const thinWithTime = (p: Params) =>
      p["with_runtime.gte"] === "140"
        ? { results: [rawFilm(1)], total_results: 1, total_pages: 1 }
        : fullPage();

    it("offers Time for an old tempo link", async () => {
      const { get } = await setup({ tmdb: thinWithTime });
      const { body } = await get("mood=laugh&tempo=slowburn&where=any");
      expect(body.suggestions).toEqual([{ remove: "time", total: 400 }]);
    });

    it("does not offer a Time read from the text", async () => {
      const { get } = await setup({ tmdb: thinWithTime });
      const { body } = await get("text=slow%20burn%20comedy&where=any");
      expect(body.interpreted.time).toBe("long");
      expect(body.suggestions).toEqual([]);
    });

    it("offers Anywhere for a thin search with no other filter", async () => {
      const { get } = await setup({
        tmdb: (p) => (p.watch_region ? { results: [rawFilm(1)], total_results: 1, total_pages: 1 } : fullPage()),
      });
      const { body } = await get("mood=laugh");
      expect(body.suggestions).toEqual([{ remove: "where", total: 400 }]);
    });

    it("lets an explicit any clear an era read from the text", async () => {
      const { get, tmdbJson } = await setup();
      const { body } = await get("text=cozy%2080s%20heist&era=any");

      expect(body.interpreted.era).toBe("classic");
      expect(body.filters.era).toBeNull();
      expect(sentParams(tmdbJson).length).toBeGreaterThan(0);
      for (const params of sentParams(tmdbJson)) expect(params["primary_release_date.lte"]).toBeUndefined();
    });

    it("does not offer to remove an era read from the text", async () => {
      const { get, tmdbJson } = await setup({ tmdb: thinWithEra });
      const { body } = await get("text=cozy%2080s%20heist");

      expect(body.interpreted.era).toBe("classic");
      expect(body.films.length).toBeLessThan(12);
      // Only the default Where: its probe keeps the era, so both thin pools sum to 2.
      expect(body.suggestions).toEqual([{ remove: "where", total: 2 }]);
      // And no probe was spent on the era.
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
