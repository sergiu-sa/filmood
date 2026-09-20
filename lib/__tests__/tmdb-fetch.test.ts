import { tmdbJson, tmdbJsonOptional, TMDBError } from "@/lib/tmdb-fetch";

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

  // Explicit no-store, not an omitted option: "uncached" must not depend on a
  // route happening to lack an `export const revalidate`.
  it("asks for no-store when revalidate is false", async () => {
    const spy = mockFetch(200);
    await tmdbJson("/search/movie", { query: "dune" }, false);
    expect(spy.mock.calls[0][1]).toEqual({ cache: "no-store" });
  });

  // `new URL` normalises dot segments, so an unguarded `..` would climb out of
  // /3 and reach another endpoint with the real key attached.
  // Checked against the normalised pathname, because `%2e%2e` folds to the
  // same place as `..` while passing any substring test on the input.
  it.each([
    "/person/1/../../authentication/token/new",
    "/person/1/%2e%2e/%2e%2e/authentication/token/new",
    "/person/1/%2E%2E/%2E%2E/authentication/token/new",
    "movie/1",
  ])("rejects %s, which escapes the API version prefix", async (path) => {
    mockFetch(200);
    await expect(tmdbJson(path)).rejects.toThrow(/Invalid TMDB path/);
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
  it("absorbs a 404 into an empty object", async () => {
    mockFetch(404);
    await expect(tmdbJsonOptional("/movie/999/similar")).resolves.toEqual({});
  });

  // The distinction the docstring promises: a wrong key or a rate limit is our
  // problem and must not degrade into a silent 200 with empty results.
  it.each([401, 429, 500, 503])("rethrows %i rather than absorbing it", async (status) => {
    mockFetch(status);
    await expect(tmdbJsonOptional("/movie/1/similar")).rejects.toBeInstanceOf(TMDBError);
  });

  // The distinction that matters: a misconfigured deployment must still 500
  // rather than silently serving empty results.
  it("still throws when the key is missing", async () => {
    mockFetch(200);
    delete process.env.TMDB_API_KEY;
    await expect(tmdbJsonOptional("/movie/1/similar")).rejects.toThrow();
  });
});
