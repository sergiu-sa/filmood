import { vi } from "vitest";
import { buildSharedDeck } from "@/lib/deck";

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

  it("returns empty array when no participants have moods", async () => {
    const result = await buildSharedDeck([
      { mood_selections: null },
      { mood_selections: null },
    ]);
    expect(result).toEqual([]);
  });

  it("returns empty array for empty participants list", async () => {
    const result = await buildSharedDeck([]);
    expect(result).toEqual([]);
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
    ).rejects.toThrow();
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
    ).rejects.toThrow(/No films matched/);
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
    ).rejects.toThrow();
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
    // Era and tempo are independent axes; both must survive.
    expect(sent.get("primary_release_date.lte")).toBe("1989-12-31");
    expect(sent.get("with_runtime.gte")).toBe("120");
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
