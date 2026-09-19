import { tmdbJson, tmdbJsonOptional, TMDBError } from "@/lib/tmdb";

function mockFetch(status: number, body: unknown = {}) {
  // The generic carries fetch's signature so `calls[0][1]` (the init object)
  // is reachable, while the implementation ignores both arguments.
  const spy = vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>(
    async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    }),
  );
  vi.stubGlobal("fetch", spy);
  return spy;
}

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.TMDB_API_KEY = "test-key";
});

describe("tmdbJson", () => {
  it("injects the api key and extra params, and caches by default", async () => {
    const spy = mockFetch(200, { ok: true });
    await tmdbJson("/movie/42/images", { include_image_language: "en,null" });

    const [url, init] = spy.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.themoviedb.org/3/movie/42/images",
    );
    expect(parsed.searchParams.get("api_key")).toBe("test-key");
    expect(parsed.searchParams.get("include_image_language")).toBe("en,null");
    expect(init).toEqual({ next: { revalidate: 86400 } });
  });

  it("sends no cache options when revalidate is false", async () => {
    const spy = mockFetch(200);
    await tmdbJson("/search/movie", { query: "dune" }, false);
    expect(spy.mock.calls[0][1]).toBeUndefined();
  });

  it("throws TMDBError carrying the upstream status", async () => {
    mockFetch(404);
    await expect(tmdbJson("/movie/999")).rejects.toBeInstanceOf(TMDBError);
    await expect(tmdbJson("/movie/999")).rejects.toMatchObject({ status: 404 });
  });

  it("throws a plain Error when the key is missing", async () => {
    mockFetch(200);
    delete process.env.TMDB_API_KEY;
    const err = await tmdbJson("/movie/1").catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TMDBError);
  });
});

describe("tmdbJsonOptional", () => {
  it("absorbs an upstream failure into an empty object", async () => {
    mockFetch(404);
    await expect(tmdbJsonOptional("/movie/999/similar")).resolves.toEqual({});
  });

  // The distinction that matters: a misconfigured deployment must still 500
  // rather than silently serving empty results.
  it("still throws when the key is missing", async () => {
    mockFetch(200);
    delete process.env.TMDB_API_KEY;
    await expect(tmdbJsonOptional("/movie/1/similar")).rejects.toThrow();
  });
});
