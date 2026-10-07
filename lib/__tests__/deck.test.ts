import { vi } from "vitest";
import { buildSharedDeck, DeckTooThinError } from "@/lib/deck";
import { TMDBError } from "@/lib/tmdb-fetch";

function fakeTMDBResponse(count: number, startId = 1) {
  return {
    results: Array.from({ length: count }, (_, i) => ({
      id: startId + i,
      title: `Film ${startId + i}`,
      poster_path: `/poster${startId + i}.jpg`,
      release_date: "2025-01-01",
      vote_average: 7.5,
      overview: `Overview for film ${startId + i}`,
      genre_ids: [35],
    })),
  };
}

describe("buildSharedDeck", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.TMDB_API_KEY = "test-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.TMDB_API_KEY;
  });

  // Unreachable from the route, which stores at least one valid mood, but an empty return would skip every guard below.
  it.each([
    [[{ mood_selections: null }, { mood_selections: null }]],
    [[]],
    [[{ mood_selections: ["not-a-mood"] }]],
  ])("refuses %j, which holds no valid mood", async (participants) => {
    await expect(buildSharedDeck(participants)).rejects.toThrow("No valid moods");
  });

  it("throws when TMDB API key is not configured", async () => {
    delete process.env.TMDB_API_KEY;
    await expect(
      buildSharedDeck([{ mood_selections: ["laugh"] }]),
    ).rejects.toThrow("TMDB API key not configured");
  });

  it("fetches films and returns a deck of up to 15 films", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeTMDBResponse(20)),
    });

    const result = await buildSharedDeck([{ mood_selections: ["laugh"] }]);

    expect(result.length).toBeLessThanOrEqual(15);
    expect(result.length).toBeGreaterThan(0);
    for (const film of result) {
      expect(film.mood_keys).toContain("laugh");
    }
  });

  // A session that locked in before a mood was retired still stores its key.
  it("folds a retired mood key into the mood that absorbed it", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeTMDBResponse(20)),
    });

    // Unnormalised, the only mood has no query, so the deck comes back empty and throws.
    const result = await buildSharedDeck([{ mood_selections: ["beautiful"] }]);

    expect(result.length).toBeGreaterThan(0);
    expect(String(vi.mocked(global.fetch).mock.calls[0][0])).toContain("with_genres=18");
    for (const film of result) {
      expect(film.mood_keys).toEqual(["cry"]);
    }
  });

  it("allocates slots proportionally across moods", async () => {
    // laugh gets 3 votes, cry gets 1 — so laugh should have more deck slots.
    // Each fetch call returns a non-overlapping ID range so dedup doesn't blur the counts.
    // The URL contains the mood params, so we key off call order (laugh is sorted first).
    const responses = [
      fakeTMDBResponse(20, 1),   // first call → laugh
      fakeTMDBResponse(20, 101), // second call → cry
    ];
    let callIndex = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      const response = responses[callIndex % responses.length];
      callIndex++;
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(response),
      });
    });

    const result = await buildSharedDeck([
      { mood_selections: ["laugh"] },
      { mood_selections: ["laugh"] },
      { mood_selections: ["laugh"] },
      { mood_selections: ["cry"] },
    ]);

    expect(result.length).toBe(15);
    // Films with IDs 1-20 were returned for laugh, 101-120 for cry.
    // laugh allocation (~11) > cry allocation (~4), so more laugh-sourced films.
    const laughCount = result.filter((f) => f.id >= 1 && f.id <= 20).length;
    const cryCount = result.filter((f) => f.id >= 101 && f.id <= 120).length;
    expect(laughCount).toBeGreaterThan(cryCount);
  });

  it("deduplicates films and merges mood_keys", async () => {
    const sharedResponse = fakeTMDBResponse(20, 1);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sharedResponse),
    });

    const result = await buildSharedDeck([
      { mood_selections: ["laugh"] },
      { mood_selections: ["cry"] },
    ]);

    const film1Entries = result.filter((f) => f.id === 1);
    expect(film1Entries.length).toBe(1);
  });

  // An empty deck is unusable: the caller writes it to the session and flips
  // to swiping, where no vote can ever complete it. Refuse rather than wedge.
  it("refuses to return an empty deck when the only mood has no films", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.reject(new Error("not JSON")),
    });

    await expect(
      buildSharedDeck([{ mood_selections: ["laugh"] }]),
    ).rejects.toBeInstanceOf(DeckTooThinError);
  });

  // The 200-with-no-results case: nothing rejects, so a rejection-counting
  // guard would sail straight past it.
  it("refuses an empty deck when TMDB returns no results at all", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [] }),
    });

    await expect(
      buildSharedDeck([{ mood_selections: ["laugh"] }]),
    ).rejects.toMatchObject({ name: "DeckTooThinError", size: 0 });
  });

  // Two films for five people isn't a deck; the route turns this into a 422 that asks for other picks.
  it("refuses a deck under five films when nothing rejected", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeTMDBResponse(4)) });

    const error = await buildSharedDeck([{ mood_selections: ["laugh"] }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DeckTooThinError);
    expect(error).toMatchObject({ size: 4 });
  });

  // A thin deck beside an outage is the outage's fault, so it stays a retryable 500.
  it("rethrows the rejection when a thin deck had one", async () => {
    global.fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(
        new URL(url).searchParams.get("with_genres") === "18"
          ? { ok: false, status: 429, json: () => Promise.reject(new Error("x")) }
          : { ok: true, json: () => Promise.resolve(fakeTMDBResponse(4)) },
      ),
    );

    const error = await buildSharedDeck([{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TMDBError);
    expect(error).toMatchObject({ status: 429 });
  });

  // An outage or a rotated key must NOT look like "no films matched": the
  // caller would write movie_deck: [] and flip the session to swiping, landing
  // the whole group on a zero-card deck with nothing reported.
  // Partial failure is survivable: the surviving mood still fills the deck.
  it("builds a deck when one mood fails and another succeeds", async () => {
    let call = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      call++;
      return Promise.resolve(
        call === 1
          ? { ok: false, status: 429, json: () => Promise.reject(new Error("x")) }
          : { ok: true, json: () => Promise.resolve(fakeTMDBResponse(20)) },
      );
    });

    const result = await buildSharedDeck([
      { mood_selections: ["laugh"] },
      { mood_selections: ["cry"] },
    ]);
    // Full length, not merely non-empty: the surviving mood's allocation is
    // topped up by the backfill, and `> 0` would pass with that deleted.
    expect(result).toHaveLength(15);
  });

  it.each([401, 429, 503])("propagates %i when every mood fails", async (status) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.reject(new Error("not JSON")),
    });

    await expect(
      buildSharedDeck([{ mood_selections: ["laugh"] }]),
    ).rejects.toMatchObject({ status });
  });

  // The deck tests otherwise only inspect the films that come back, so the
  // query that produced them — the part the URLSearchParams -> Record refactor
  // actually moved — had no coverage at all.
  it("sends the mood params, page 1, and group refinements to TMDB", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeTMDBResponse(20)),
    });
    global.fetch = spy;

    await buildSharedDeck([
      { mood_selections: ["laugh"], era: "classic", tempo: "slowburn" },
    ]);

    const sent = new URL(spy.mock.calls[0][0] as string).searchParams;
    expect(sent.get("page")).toBe("1");
    expect(sent.get("language")).toBe("en-US");
    expect(sent.get("api_key")).toBe("test-key");
    // Era and tempo are independent axes; both must survive. A stored tempo is
    // read as a Time (spec §8), so Slow-burn is "Long & immersive": 140+ minutes.
    expect(sent.get("primary_release_date.lte")).toBe("1989-12-31");
    expect(sent.get("with_runtime.gte")).toBe("140");
    // Where is still Norwegian subscription streaming for every deck.
    expect(sent.get("watch_region")).toBe("NO");
    expect(sent.get("with_watch_monetization_types")).toBe("flatrate");
  });

  it("reads a Fast-paced majority as Under 100 min, keeping the runtime floor", async () => {
    const spy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeTMDBResponse(20)),
    });
    global.fetch = spy;

    await buildSharedDeck([{ mood_selections: ["laugh"], tempo: "fastpaced" }]);

    const sent = new URL(spy.mock.calls[0][0] as string).searchParams;
    expect(sent.get("with_runtime.lte")).toBe("100");
    expect(sent.get("with_runtime.gte")).toBe("60");
  });

  const sentParams = (spy: ReturnType<typeof vi.fn>) =>
    spy.mock.calls.map(([url]) => new URL(url as string).searchParams);
  const fullTMDB = () =>
    vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(fakeTMDBResponse(20)) });

  describe("Time", () => {
    // Participants who locked in before migration 010 only stored a tempo.
    it("votes over time, reading a stored tempo as a Time", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([
        { mood_selections: ["laugh"], time: "long" },
        { mood_selections: ["laugh"], time: "long" },
        { mood_selections: ["laugh"], tempo: "fastpaced" },
      ]);
      expect(sentParams(spy)[0].get("with_runtime.gte")).toBe("140");
      expect(sentParams(spy)[0].has("with_runtime.lte")).toBe(false);
    });

    // Above, time decides; here the stored tempo breaks what would otherwise be a tie.
    it("counts a stored tempo as a vote", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([
        { mood_selections: ["laugh"], time: "long" },
        { mood_selections: ["laugh"], tempo: "slowburn" },
        { mood_selections: ["laugh"], time: "short" },
      ]);
      expect(sentParams(spy)[0].get("with_runtime.gte")).toBe("140");
    });

    it("lets a participant's time beat their own stored tempo", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"], time: "short", tempo: "slowburn" }]);
      expect(sentParams(spy)[0].get("with_runtime.lte")).toBe("100");
      expect(sentParams(spy)[0].get("with_runtime.gte")).toBe("60");
    });

    it("sets no length on a tie", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([
        { mood_selections: ["laugh"], time: "long" },
        { mood_selections: ["laugh"], tempo: "fastpaced" },
      ]);
      expect(sentParams(spy)[0].get("with_runtime.gte")).toBe("60");
      expect(sentParams(spy)[0].has("with_runtime.lte")).toBe(false);
    });

    it("reads medium as Under 2 hours", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"], time: "medium" }]);
      expect(sentParams(spy)[0].get("with_runtime.lte")).toBe("120");
    });
  });

  describe("Where", () => {
    it("limits every call to the group's services in Norway", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }], [8, 76]);
      for (const sent of sentParams(spy)) {
        expect(sent.get("with_watch_providers")).toBe("8|76");
        expect(sent.get("watch_region")).toBe("NO");
        expect(sent.get("with_watch_monetization_types")).toBe("flatrate");
      }
    });

    it("uses plain Norway streaming when nobody saved a service", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"] }], []);
      for (const sent of sentParams(spy)) {
        expect(sent.has("with_watch_providers")).toBe(false);
        expect(sent.get("watch_region")).toBe("NO");
      }
    });

    // An empty deck rolls the last lock-in back, and a retry would hit the same one.
    it("falls back to Norway streaming when the group's services hold nothing", async () => {
      const spy = vi.fn().mockImplementation((url: string) => {
        const onServices = new URL(url).searchParams.has("with_watch_providers");
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(onServices ? { results: [] } : fakeTMDBResponse(20)),
        });
      });
      global.fetch = spy;

      const result = await buildSharedDeck([{ mood_selections: ["laugh"] }], [431]);

      expect(result).toHaveLength(15);
      const sent = sentParams(spy);
      expect(sent[0].get("with_watch_providers")).toBe("431");
      expect(sent.at(-1)!.has("with_watch_providers")).toBe(false);
    });

    it("rebuilds a thin services deck on Norway, once", async () => {
      const spy = vi.fn().mockImplementation((url: string) => {
        const onServices = new URL(url).searchParams.has("with_watch_providers");
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(onServices ? fakeTMDBResponse(4) : fakeTMDBResponse(20, 100)),
        });
      });
      global.fetch = spy;

      const result = await buildSharedDeck([{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }], [8]);

      expect(result).toHaveLength(15);
      const sent = sentParams(spy).map((p) => p.get("with_watch_providers"));
      const firstNorway = sent.indexOf(null);
      expect(firstNorway).toBeGreaterThan(0);
      expect(sent.slice(0, firstNorway).every((v) => v === "8")).toBe(true);
      expect(sent.slice(firstNorway).every((v) => v === null)).toBe(true);
    });

    it("doesn't retry an outage on Norway", async () => {
      const spy = vi.fn().mockResolvedValue({ ok: false, status: 429, json: () => Promise.reject(new Error("x")) });
      global.fetch = spy;

      await expect(buildSharedDeck([{ mood_selections: ["laugh"] }], [8])).rejects.toThrow();
      for (const sent of sentParams(spy)) expect(sent.get("with_watch_providers")).toBe("8");
    });
  });

  describe("certification cap", () => {
    // Picking "Everyone's watching" means kids are watching, so it caps the whole deck.
    it("caps every mood's pool when anyone picks family", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"] }, { mood_selections: ["dark", "family"] }]);
      const sent = sentParams(spy);
      expect(sent.some((p) => p.get("with_genres") === "35")).toBe(true);
      for (const p of sent) {
        expect(p.get("certification_country")).toBe("US");
        expect(p.get("certification.gte")).toBe("G");
        expect(p.get("certification.lte")).toBe("PG");
      }
    });

    it("caps nothing when nobody picks family", async () => {
      const spy = fullTMDB();
      global.fetch = spy;
      await buildSharedDeck([{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }]);
      for (const p of sentParams(spy)) expect(p.has("certification_country")).toBe(false);
    });
  });

  // The deck shares the solo ladder: a thin mood loosens instead of starving its slots.
  it("climbs a tier for a thin mood, on hour-cached calls", async () => {
    const spy = vi.fn().mockImplementation((url: string) => {
      const withKeywords = new URL(url).searchParams.has("with_keywords");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(withKeywords ? fakeTMDBResponse(3) : fakeTMDBResponse(20, 100)),
      });
    });
    global.fetch = spy;

    // dark is genre-essential, so tier 1 drops its keywords.
    const result = await buildSharedDeck([{ mood_selections: ["dark"] }]);

    const sent = spy.mock.calls.map(([url]) => new URL(url as string).searchParams);
    expect(sent).toHaveLength(2);
    expect(sent[0].has("with_keywords")).toBe(true);
    expect(sent[1].has("with_keywords")).toBe(false);
    expect(result).toHaveLength(15);
    for (const film of result) expect(film.id).toBeGreaterThanOrEqual(100);
    for (const [, init] of spy.mock.calls) expect(init).toEqual({ next: { revalidate: 3600 } });
  });

  it("each film in the deck has the correct shape", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fakeTMDBResponse(20)),
    });

    const result = await buildSharedDeck([{ mood_selections: ["laugh"] }]);

    for (const film of result) {
      expect(film).toHaveProperty("id");
      expect(film).toHaveProperty("title");
      expect(film).toHaveProperty("poster_path");
      expect(film).toHaveProperty("release_date");
      expect(film).toHaveProperty("vote_average");
      expect(film).toHaveProperty("overview");
      expect(film).toHaveProperty("genre_ids");
      expect(film).toHaveProperty("mood_keys");
      expect(Array.isArray(film.mood_keys)).toBe(true);
    }
  });
});
