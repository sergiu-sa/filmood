import { NextRequest } from "next/server";
import { TMDBError } from "@/lib/tmdb-fetch";

const rows = [
  { id: "a", movie_id: 1, movie_title: "Newest", poster_path: "/1.jpg", added_at: "2026-10-09T10:00:00+00:00" },
  { id: "b", movie_id: 2, movie_title: "Middle", poster_path: null, added_at: "2026-10-08T10:00:00+00:00" },
  { id: "c", movie_id: 3, movie_title: "Oldest", poster_path: "/3.jpg", added_at: "2026-10-07T10:00:00+00:00" },
];

const { getFilmDetail } = vi.hoisted(() => ({ getFilmDetail: vi.fn() }));

vi.mock("@/lib/filmData", () => ({ getFilmDetail }));
vi.mock("@/lib/supabase-server", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => Promise.resolve({ data: rows, error: null }) }),
      }),
    }),
  }),
  getAuthUser: async () => ({ id: "user-1" }),
}));

const get = async (query: string) => {
  const { GET } = await import("@/app/api/watchlist/route");
  return GET(new NextRequest(`http://localhost/api/watchlist${query}`));
};

describe("GET /api/watchlist ?details", () => {
  beforeEach(() => {
    getFilmDetail.mockReset();
  });

  // WatchlistPreview, FilmActions and the home hero read this body.
  it("without details looks nothing up and answers the rows as stored", async () => {
    const res = await get("");
    expect(getFilmDetail).not.toHaveBeenCalled();
    expect(await res.json()).toEqual({ watchlist: rows });
  });

  it("with details=1 adds each film's release date and rating", async () => {
    getFilmDetail.mockImplementation(async (id: number) =>
      id === 2 ? { release_date: "", vote_average: 0 } : { release_date: `201${id}-05-01`, vote_average: id + 0.5 },
    );
    const res = await get("?details=1");
    expect(getFilmDetail.mock.calls.map(([id]) => id)).toEqual([1, 2, 3]);
    expect((await res.json()).watchlist).toEqual([
      { ...rows[0], release_date: "2011-05-01", vote_average: 1.5 },
      // An undated film: null, so the card hides the year instead of showing "N/A". A 0 rating is TMDB's.
      { ...rows[1], release_date: null, vote_average: 0 },
      { ...rows[2], release_date: "2013-05-01", vote_average: 3.5 },
    ]);
  });

  it("a failed lookup nulls that row's fields and still answers 200", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    getFilmDetail.mockImplementation(async (id: number) => {
      if (id === 2) throw new TMDBError(404, "/movie/2");
      return { release_date: "2020-01-01", vote_average: 7 };
    });
    const res = await get("?details=1");
    expect(res.status).toBe(200);
    const { watchlist } = await res.json();
    expect(watchlist[1]).toEqual({ ...rows[1], release_date: null, vote_average: null });
    expect(watchlist[0]).toMatchObject({ release_date: "2020-01-01", vote_average: 7 });
    expect(watchlist[2]).toMatchObject({ release_date: "2020-01-01", vote_average: 7 });
    expect(error).toHaveBeenCalledWith("1 of 3 TMDB calls failed", [expect.any(TMDBError)]);
    error.mockRestore();
  });
});
