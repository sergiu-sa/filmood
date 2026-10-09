import { NextRequest } from "next/server";

async function setup() {
  const tmdbJson = vi.fn(async () => ({ results: [], total_pages: 1 }));
  vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
    tmdbJson,
  }));
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
});
