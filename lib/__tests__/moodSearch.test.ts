import { vi } from "vitest";

vi.mock("@/lib/tmdb-fetch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
  tmdbJson: vi.fn(),
}));

import { tmdbJson, TMDBError } from "@/lib/tmdb-fetch";
import {
  MIN_RESULTS,
  MOOD_DISCOVER_REVALIDATE,
  RESULT_LIMIT,
  runMoodSearch,
  searchCap,
  searchMood,
} from "@/lib/moodSearch";
import {
  activeFilterKeys,
  EMPTY_FILTERS,
  type FilterKey,
  type Filters,
} from "@/lib/moodFilters";
import { mulberry32 } from "@/lib/seededRandom";

type Params = Record<string, string>;

const mockTmdb = vi.mocked(tmdbJson);

const film = (id: number) => ({
  id,
  title: `Film ${id}`,
  poster_path: null,
  release_date: "2020-01-01",
  vote_average: 7,
  vote_count: 1000,
  overview: "",
  genre_ids: [35],
});

const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i);

const page = (filmIds: number[], total = filmIds.length, totalPages = 1) => ({
  results: filmIds.map(film),
  total_results: total,
  total_pages: totalPages,
});

/** Answer every discover call from its params. */
function respond(handler: (params: Params) => unknown) {
  mockTmdb.mockImplementation(async (_path, params = {}) => {
    const body = handler(params);
    if (body instanceof Error) throw body;
    return body as never;
  });
}

const calls = () => mockTmdb.mock.calls.map(([, params]) => params as Params);
const isMood = (params: Params, genres: string) => params.with_genres === genres;
const withFilters = (f: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...f });
const rng = () => mulberry32(1);
// No free text here, so every active filter is one the user can remove.
const search = (
  moodKeys: string[],
  f: Filters,
  random: () => number,
  removable: FilterKey[] = activeFilterKeys(f),
) => runMoodSearch(moodKeys, f, random, removable);

beforeEach(() => {
  mockTmdb.mockReset();
});

describe("searchMood — page fetch", () => {
  it("asks /discover/movie for page 1, cached for an hour", async () => {
    respond(() => page(ids(1, 20)));
    await searchMood("laugh", EMPTY_FILTERS, rng());

    expect(mockTmdb).toHaveBeenCalledTimes(1);
    const [path, params, revalidate] = mockTmdb.mock.calls[0];
    expect(path).toBe("/discover/movie");
    expect(params).toMatchObject({ page: "1", language: "en-US", with_genres: "35" });
    expect(revalidate).toBe(MOOD_DISCOVER_REVALIDATE);
    expect(MOOD_DISCOVER_REVALIDATE).toBe(3600);
  });

  // The deck's stubs return no totals; 20 results must still count as enough.
  it("falls back to the result count and one page when totals are missing", async () => {
    respond(() => ({ results: ids(1, 20).map(film) }));
    const pool = await searchMood("laugh", EMPTY_FILTERS, rng());

    expect(mockTmdb).toHaveBeenCalledTimes(1);
    expect(pool).toMatchObject({ tier: 0, total: 20 });
    expect(pool.films).toHaveLength(20);
  });

  it("treats a 404 as an empty page", async () => {
    respond(() => new TMDBError(404, "/discover/movie"));
    const pool = await searchMood("laugh", EMPTY_FILTERS, rng());
    expect(pool.films).toEqual([]);
    expect(pool.total).toBe(0);
  });

  // A throttled deploy must not render as "no films match your mood".
  it.each([401, 429, 503])("propagates a page-1 %i", async (status) => {
    respond(() => new TMDBError(status, "/discover/movie"));
    await expect(searchMood("laugh", EMPTY_FILTERS, rng())).rejects.toMatchObject({ status });
  });
});

describe("searchMood — ladder", () => {
  it("stops at the first tier with enough results", async () => {
    // dark is genre-essential: tier 0 has keywords, tier 1 drops them.
    respond((p) => (p.with_keywords ? page(ids(1, 5)) : page(ids(100, 20), 40)));
    const pool = await searchMood("dark", EMPTY_FILTERS, rng());

    expect(calls()).toHaveLength(2);
    expect(calls()[0].with_keywords).toBeDefined();
    expect(calls()[1].with_keywords).toBeUndefined();
    expect(pool.tier).toBe(1);
    expect(pool.total).toBe(40);
  });

  it("does not climb when tier 0 is enough", async () => {
    respond(() => page(ids(1, 20), MIN_RESULTS));
    const pool = await searchMood("dark", EMPTY_FILTERS, rng());
    expect(calls()).toHaveLength(1);
    expect(pool.tier).toBe(0);
  });

  // laugh has no keywords, so tier 1 is tier 0 again.
  it("skips a tier whose query equals the previous one", async () => {
    respond((p) => (p["vote_count.gte"] === "500" ? page(ids(1, 3)) : page(ids(50, 20))));
    const pool = await searchMood("laugh", EMPTY_FILTERS, rng());

    expect(calls().map((p) => p["vote_count.gte"])).toEqual(["500", "250"]);
    expect(pool.tier).toBe(2);
  });

  it("keeps the tier with the most results when none is enough", async () => {
    respond((p) => {
      if (p.with_keywords) return page(ids(1, 4), 4);
      if (p["vote_count.gte"] === "300") return page(ids(10, 9), 9);
      return page(ids(20, 7), 7);
    });
    const pool = await searchMood("dark", EMPTY_FILTERS, rng());

    expect(calls()).toHaveLength(3);
    expect(pool.tier).toBe(1);
    expect(pool.films.map((f) => f.id)).toEqual(ids(10, 9));
  });

  it("applies the user's filters at every tier", async () => {
    respond(() => page([1]));
    await searchMood("dark", withFilters({ era: "classic", time: "short" }), rng());

    expect(calls()).toHaveLength(3);
    for (const params of calls()) {
      expect(params["primary_release_date.lte"]).toBe("1989-12-31");
      expect(params["with_runtime.lte"]).toBe("100");
      expect(params.watch_region).toBe("NO");
      expect(params.with_watch_monetization_types).toBe("flatrate");
    }
  });

  it("keeps a long Time's raised runtime floor at every tier", async () => {
    respond(() => page([1]));
    await searchMood("dark", withFilters({ time: "long" }), rng());

    expect(calls()).toHaveLength(3);
    for (const params of calls()) expect(params["with_runtime.gte"]).toBe("140");
  });

  it("keeps My services' providers at every tier", async () => {
    respond(() => page([1]));
    await searchMood("dark", withFilters({ where: "mine", providers: [8, 76] }), rng());

    expect(calls()).toHaveLength(3);
    for (const params of calls()) expect(params.with_watch_providers).toBe("8|76");
  });

  it("asks for no streaming region when Where is Anywhere", async () => {
    respond(() => page([1]));
    await searchMood("dark", withFilters({ where: "any" }), rng());
    for (const params of calls()) {
      expect(params.watch_region).toBeUndefined();
      expect(params.with_watch_monetization_types).toBeUndefined();
    }
  });

  it("drops text keywords with a genre-essential mood's keyword side", async () => {
    respond(() => page([1]));
    await searchMood("dark", withFilters({ extraKeywords: [999] }), rng());
    const [tier0, tier1] = calls();
    expect(tier0.with_keywords).toContain("999");
    expect(tier1.with_keywords).toBeUndefined();
  });

  it("keeps text keywords for a keyword-essential mood", async () => {
    respond(() => page([1]));
    await searchMood("mindbending", withFilters({ extraKeywords: [999] }), rng());
    for (const params of calls()) expect(params.with_keywords).toContain("999");
  });
});

describe("searchMood — extra page", () => {
  it("skips the extra page when there is only one", async () => {
    respond(() => page(ids(1, 20), 20, 1));
    await searchMood("laugh", EMPTY_FILTERS, rng());
    expect(calls()).toHaveLength(1);
  });

  it("adds one page from 2..5 and dedupes it against page 1", async () => {
    respond((p) => (p.page === "1" ? page(ids(1, 20), 400, 20) : page([20, 21, 22], 400, 20)));
    const pool = await searchMood("laugh", EMPTY_FILTERS, rng());

    expect(calls()).toHaveLength(2);
    const extra = Number(calls()[1].page);
    expect(extra).toBeGreaterThanOrEqual(2);
    expect(extra).toBeLessThanOrEqual(5);
    expect(pool.films.map((f) => f.id)).toEqual([...ids(1, 20), 21, 22]);
  });

  it("never asks for a page past total_pages", async () => {
    respond((p) => (p.page === "1" ? page(ids(1, 20), 40, 2) : page([99], 40, 2)));
    for (let seed = 1; seed <= 10; seed++) {
      mockTmdb.mockClear();
      await searchMood("laugh", EMPTY_FILTERS, mulberry32(seed));
      expect(calls()[1].page).toBe("2");
    }
  });

  it("keeps page 1 when the extra page fails", async () => {
    respond((p) =>
      p.page === "1" ? page(ids(1, 20), 400, 20) : new TMDBError(429, "/discover/movie"),
    );
    const pool = await searchMood("laugh", EMPTY_FILTERS, rng());
    expect(pool.films.map((f) => f.id)).toEqual(ids(1, 20));
  });

  it("picks the same extra page for the same seed", async () => {
    respond((p) => page(p.page === "1" ? ids(1, 20) : [], 400, 20));
    const pick = async (seed: number) => {
      mockTmdb.mockClear();
      await searchMood("laugh", EMPTY_FILTERS, mulberry32(seed));
      return calls()[1].page;
    };
    expect(await pick(7)).toBe(await pick(7));
  });
});

describe("runMoodSearch — blend", () => {
  // laugh = with_genres 35, thrilling = 28.
  const twoPools = (a: number[], b: number[]) =>
    respond((p) => (isMood(p, "35") ? page(a, 400) : page(b, 400)));

  it("shuffles a single mood and tags it", async () => {
    respond(() => page(ids(1, 20)));
    const result = await search(["laugh"], EMPTY_FILTERS, rng());

    expect(result.films.map((f) => f.id).sort((x, y) => x - y)).toEqual(ids(1, 20));
    expect(result.films.map((f) => f.id)).not.toEqual(ids(1, 20));
    for (const f of result.films) expect(f.moodKeys).toEqual(["laugh"]);
    expect(result).toMatchObject({ relaxed: 0, partial: false, suggestions: [], relatedMoods: [] });
  });

  it("puts the intersection first, then alternates the two moods", async () => {
    twoPools([...ids(1, 6), 100, 101], [100, 101, ...ids(200, 6)]);
    const result = await search(["laugh", "thrilling"], EMPTY_FILTERS, rng());
    const keys = result.films.map((f) => f.moodKeys.join("+"));

    expect(result.films.slice(0, 2).map((f) => f.id).sort()).toEqual([100, 101]);
    expect(keys.slice(0, 2)).toEqual(["laugh+thrilling", "laugh+thrilling"]);
    expect(keys.slice(2)).toEqual(
      Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? "laugh" : "thrilling")),
    );
    expect(new Set(result.films.map((f) => f.id)).size).toBe(result.films.length);
  });

  it("caps the blend at RESULT_LIMIT", async () => {
    twoPools(ids(1, 20), ids(100, 20));
    const result = await search(["laugh", "thrilling"], EMPTY_FILTERS, rng());
    expect(result.films).toHaveLength(RESULT_LIMIT);
  });

  it("gives the same order for the same seed and a different one for another", async () => {
    twoPools(ids(1, 20), ids(100, 20));
    const order = async (seed: number) =>
      (await search(["laugh", "thrilling"], EMPTY_FILTERS, mulberry32(seed))).films.map(
        (f) => f.id,
      );
    expect(await order(11)).toEqual(await order(11));
    expect(await order(11)).not.toEqual(await order(12));
  });

  // The pools run in parallel; which one TMDB answers first must not change the list.
  it("gives the same order whichever pool resolves first", async () => {
    const run = async (slow: string) => {
      mockTmdb.mockImplementation(async (_path, params = {}) => {
        const p = params as Params;
        if (p.with_genres === slow) await new Promise((r) => setTimeout(r, 5));
        // Each page holds different films, so the extra-page pick shows in the result.
        const base = (isMood(p, "35") ? 0 : 100_000) + Number(p.page) * 1000;
        return page(ids(base, p.page === "1" ? 20 : 5), 400, 20) as never;
      });
      const result = await search(["laugh", "thrilling"], EMPTY_FILTERS, mulberry32(3));
      return result.films.map((f) => f.id);
    };
    expect(await run("35")).toEqual(await run("28"));
  });

  // Picking "Everyone's watching" means kids are watching, so the cap covers both pools.
  it("carries the family cap into the other mood's pool", async () => {
    respond(() => page(ids(1, 20)));
    await search(["family", "dark"], EMPTY_FILTERS, rng());

    expect(calls().some((p) => p.with_genres === "80")).toBe(true);
    for (const params of calls()) {
      expect(params).toMatchObject({
        certification_country: "US",
        "certification.gte": "G",
        "certification.lte": "PG",
      });
    }
  });

  it("reports the highest tier either pool needed", async () => {
    respond((p) => {
      if (isMood(p, "35")) return page(ids(1, 20));
      return p.with_keywords ? page([900]) : page(ids(100, 20));
    });
    const result = await search(["laugh", "dark"], EMPTY_FILTERS, rng());
    expect(result.relaxed).toBe(1);
  });
});

describe("searchCap", () => {
  // The deck and the blend share it: one family pick caps every pool.
  it("is family's cap when any searched mood is family, and none otherwise", () => {
    expect(searchCap(["laugh", "family"])).toEqual({ country: "US", lte: "PG" });
    expect(searchCap(["laugh", "dark"])).toBeUndefined();
  });
});

describe("runMoodSearch — failure", () => {
  it("returns the surviving pool and flags partial when one mood fails", async () => {
    respond((p) => (isMood(p, "35") ? new TMDBError(429, "/discover/movie") : page(ids(100, 20))));
    const result = await search(["laugh", "thrilling"], EMPTY_FILTERS, rng());

    expect(result.partial).toBe(true);
    expect(result.films).toHaveLength(20);
    for (const f of result.films) expect(f.moodKeys).toEqual(["thrilling"]);
  });

  it("throws the first failure when every mood fails", async () => {
    respond(() => new TMDBError(429, "/discover/movie"));
    await expect(
      search(["laugh", "thrilling"], EMPTY_FILTERS, rng()),
    ).rejects.toMatchObject({ status: 429 });
  });

  // Nothing to show plus a real failure is an outage, not "no matches".
  it("throws when the only surviving pool is empty", async () => {
    respond((p) => (isMood(p, "35") ? new TMDBError(503, "/discover/movie") : page([])));
    await expect(
      search(["laugh", "thrilling"], EMPTY_FILTERS, rng()),
    ).rejects.toMatchObject({ status: 503 });
  });
});

describe("runMoodSearch — suggestions and related moods", () => {
  it("probes each active filter when the result is thin", async () => {
    respond((p) => {
      const era = Boolean(p["primary_release_date.lte"]);
      const time = Boolean(p["with_runtime.lte"]);
      const norway = Boolean(p.watch_region);
      if (era && time && norway) return page(ids(1, 3), 3);
      if (!era) return page(ids(1, 20), 150);
      if (!time) return page(ids(1, 20), 40);
      return page(ids(1, 20), 60);
    });
    const result = await search(["laugh"], withFilters({ era: "classic", time: "short" }), rng());

    expect(result.films).toHaveLength(3);
    expect(result.suggestions).toEqual([
      { remove: "era", total: 150 },
      { remove: "where", total: 60 },
      { remove: "time", total: 40 },
    ]);
  });

  it("sums a probe across both pools, largest first", async () => {
    respond((p) => {
      const era = Boolean(p["primary_release_date.lte"]);
      const time = Boolean(p["with_runtime.lte"]);
      const norway = Boolean(p.watch_region);
      if (era && time && norway) return page([isMood(p, "35") ? 1 : 2], 1);
      if (!era) return page([], 10);
      if (!time) return page([], 20);
      return page([], 30);
    });
    const result = await search(
      ["laugh", "thrilling"],
      withFilters({ era: "classic", time: "short" }),
      rng(),
    );

    expect(result.films).toHaveLength(2);
    expect(result.suggestions).toEqual([
      { remove: "where", total: 60 },
      { remove: "time", total: 40 },
      { remove: "era", total: 20 },
    ]);
  });

  // Three filters × two pools, down from five legacy refinements × two.
  it("makes at most six probe calls", async () => {
    const filtered = (p: Params) =>
      Boolean(p["primary_release_date.lte"] && p["with_runtime.lte"] && p.watch_region);
    respond((p) => (filtered(p) ? page([isMood(p, "35") ? 1 : 2], 1) : page([], 50)));
    await search(["laugh", "thrilling"], withFilters({ era: "classic", time: "short" }), rng());

    expect(calls().filter((p) => !filtered(p))).toHaveLength(6);
  });

  it("only probes the filters it was told the user can remove", async () => {
    respond((p) => (p["primary_release_date.lte"] && p["with_runtime.lte"] ? page([1], 1) : page([], 50)));
    const result = await search(
      ["laugh"],
      withFilters({ era: "classic", time: "short" }),
      rng(),
      ["time"],
    );

    expect(result.suggestions).toEqual([{ remove: "time", total: 50 }]);
    // Every call keeps the era and the region: nothing probed without them.
    for (const params of calls()) {
      expect(params["primary_release_date.lte"]).toBe("1989-12-31");
      expect(params.watch_region).toBe("NO");
    }
  });

  it("makes no probe calls when nothing is removable", async () => {
    respond(() => page([1], 1));
    const result = await search(["laugh"], withFilters({ era: "classic" }), rng(), []);
    expect(result.suggestions).toEqual([]);
    // tier 0 and tier 2 only.
    expect(calls()).toHaveLength(2);
  });

  it("drops a suggestion that would not add films", async () => {
    respond(() => page([1, 2], 2));
    const result = await search(["laugh"], withFilters({ era: "fresh" }), rng());
    expect(result.suggestions).toEqual([]);
  });

  it("makes no probe calls without an active filter", async () => {
    respond(() => page([1, 2], 2));
    const result = await search(["laugh"], withFilters({ where: "any" }), rng());
    expect(result.suggestions).toEqual([]);
    // tier 0 and tier 2 only: laugh's tier 1 equals tier 0.
    expect(calls()).toHaveLength(2);
  });

  // Streaming in Norway is the default, and Anywhere loosens it.
  it("counts the default Where as an active filter", async () => {
    respond((p) => (p.watch_region ? page([1, 2], 2) : page(ids(1, 20), 90)));
    const result = await search(["laugh"], EMPTY_FILTERS, rng());

    expect(result.suggestions).toEqual([{ remove: "where", total: 90 }]);
    expect(calls().at(-1)?.watch_region).toBeUndefined();
  });

  it("makes no probe calls when the result is not thin", async () => {
    respond(() => page(ids(1, 20), 400));
    const result = await search(["laugh"], withFilters({ era: "classic" }), rng());
    expect(result.suggestions).toEqual([]);
    expect(calls()).toHaveLength(1);
  });

  it("ignores a probe that fails", async () => {
    respond((p) => {
      if (p["primary_release_date.lte"]) return page([1], 1);
      return new TMDBError(429, "/discover/movie");
    });
    const result = await search(["laugh"], withFilters({ era: "classic", where: "any" }), rng());
    expect(result.films).toHaveLength(1);
    expect(result.suggestions).toEqual([]);
  });

  it("probes at the tier the pool settled on", async () => {
    respond((p) => {
      if (!p["primary_release_date.lte"]) return page([], 50);
      return p["vote_count.gte"] === "150" ? page([1], 1) : page([], 0);
    });
    await search(["dark"], withFilters({ era: "classic", where: "any" }), rng());
    const probe = calls().at(-1);
    expect(probe?.["primary_release_date.lte"]).toBeUndefined();
    expect(probe?.["vote_count.gte"]).toBe("150");
    expect(probe?.with_keywords).toBeUndefined();
  });

  it("offers the first mood's neighbours only when nothing matched", async () => {
    respond(() => page([]));
    const empty = await search(["dark"], EMPTY_FILTERS, rng());
    expect(empty.relatedMoods).toEqual(["unsettled", "thrilling", "mindbending"]);

    respond(() => page([1]));
    const thin = await search(["dark"], EMPTY_FILTERS, rng());
    expect(thin.relatedMoods).toEqual([]);
  });

  it("never offers a mood that was already searched", async () => {
    respond(() => page([]));
    const result = await search(["dark", "unsettled"], EMPTY_FILTERS, rng());
    expect(result.relatedMoods).toEqual(["thrilling", "mindbending"]);
  });
});
