import { NextRequest } from "next/server";

/** `status` makes every TMDB call fail with it. */
async function setup(status?: number) {
  const tmdbJson = vi.fn(async (path: string) => {
    if (status) throw new TMDBError(status, path);
    return { results: [], total_pages: 1 };
  });
  vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
    tmdbJson,
  }));
  // From the registry the route loads, so its instanceof checks match.
  const { TMDBError } = await import("@/lib/tmdb-fetch");
  const { GET } = await import("@/app/api/movies/browse/route");
  const get = async (query: string) => {
    const res = await GET(new NextRequest(`http://localhost/api/movies/browse?${query}`));
    return { status: res.status, body: await res.json() };
  };
  return { get, tmdbJson };
}

describe("GET /api/movies/browse", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("sends a numeric genre to TMDB as with_genres", async () => {
    const { get, tmdbJson } = await setup();
    expect((await get("category=by-genre&genre=35")).status).toBe(200);
    expect(tmdbJson).toHaveBeenCalledWith(
      "/discover/movie",
      expect.objectContaining({ with_genres: "35" }),
      false,
    );
  });

  // TMDB reads "," as AND and "|" as OR, so a raw genre could rewrite the query.
  it.each(["12abc", "35,18", "35|18", ""])("rejects genre=%s before calling TMDB", async (genre) => {
    const { get, tmdbJson } = await setup();
    expect(await get(`category=by-genre&genre=${encodeURIComponent(genre)}`)).toEqual({
      status: 400,
      body: { error: "Invalid genre" },
    });
    expect(tmdbJson).not.toHaveBeenCalled();
  });

  // Every category is a fixed path: a 404 is TMDB moving an endpoint, our outage.
  it("answers a TMDB 404 with a 500, logged", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { get } = await setup(404);

    expect(await get("category=top-rated")).toEqual({ status: 500, body: { error: "Failed to browse films" } });
    expect(logged).toHaveBeenCalledWith("Failed to browse films", expect.objectContaining({ status: 404 }));
  });
});
