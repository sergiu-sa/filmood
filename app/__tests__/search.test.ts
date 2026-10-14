import { NextRequest } from "next/server";
import { GET } from "@/app/api/movies/search/route";
import { mockTMDB } from "@/lib/__tests__/helpers/tmdb-mock";

const film = (id: number) => ({
  id,
  title: `Film ${id}`,
  poster_path: `/${id}.jpg`,
  release_date: "2020-01-01",
  vote_average: 7,
  overview: "",
  popularity: id,
});

const person = (id: number) => ({ media_type: "person", id, name: `Person ${id}` });
const movie = (id: number) => ({ media_type: "movie", ...film(id) });
const directed = (id: number) => ({ ...film(id), job: "Director" });
const ids = (body: { films: { id: number }[] }) => body.films.map((f) => f.id);

const search = async (query: string) => {
  const res = await GET(new NextRequest(`http://localhost/api/movies/search?${query}`));
  return { status: res.status, body: await res.json() };
};

const searchAll = () => search("query=dune&type=all");

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.TMDB_API_KEY = "test-key";
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("GET /api/movies/search?type=all", () => {
  // A 404 on the first leg must not keep the second leg's outage out of 5xx alerting.
  it("answers 500 when neither leg has films, and logs each failure once", async () => {
    mockTMDB({ "/search/movie": 404, "/search/multi": 503 });

    expect((await searchAll()).status).toBe(500);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenCalledWith("Failed to search films", expect.objectContaining({ status: 503 }));
  });

  // The title leg answered, so "every leg rejected" would call this "no hits".
  it("answers 500 when one leg finds nothing and the other is down", async () => {
    mockTMDB({ "/search/movie": { results: [] }, "/search/multi": 503 });

    expect((await searchAll()).status).toBe(500);
  });

  it("keeps the title films when the person leg fails, and logs the failure once", async () => {
    mockTMDB({ "/search/movie": { results: [film(1), film(2)] }, "/search/multi": 503 });

    const { status, body } = await searchAll();
    expect(status).toBe(200);
    expect(body.films.map((f: { id: number }) => f.id)).toEqual([1, 2]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it("keeps the person's films when the title search fails, and logs the failure once", async () => {
    mockTMDB({
      "/search/movie": 503,
      "/search/multi": { results: [person(7)] },
      "/person/7/movie_credits": { cast: [film(10)] },
    });

    const { status, body } = await searchAll();
    expect(status).toBe(200);
    expect(ids(body)).toEqual([10]);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/movies/search?type=all, order", () => {
  it("lists the person's films first when TMDB's own search ranks them above every film", async () => {
    mockTMDB({
      "/search/movie": { results: [film(1), film(2)] },
      // TV doesn't count: this app only lists films.
      "/search/multi": { results: [{ media_type: "tv", id: 900 }, person(7), movie(1)] },
      "/person/7/movie_credits": { cast: [film(10)], crew: [directed(20)] },
    });

    expect(ids((await searchAll()).body)).toEqual([20, 10, 1, 2]);
  });

  it("lists titles first when a film outranks the person", async () => {
    mockTMDB({
      "/search/movie": { results: [film(1), film(2)] },
      "/search/multi": { results: [movie(1), person(7)] },
      "/person/7/movie_credits": { cast: [film(10)], crew: [directed(20)] },
    });

    expect(ids((await searchAll()).body)).toEqual([1, 2, 20, 10]);
  });

  // Acting first used to push a director's films past the cut.
  it("mixes acting and directing by popularity, other crew jobs left out, each film once", async () => {
    mockTMDB({
      "/search/movie": { results: [] },
      "/search/multi": { results: [person(7)] },
      "/person/7/movie_credits": {
        cast: [film(5), film(15), film(8)],
        crew: [directed(12), directed(8), { ...film(40), job: "Producer" }],
      },
    });

    expect(ids((await searchAll()).body)).toEqual([15, 12, 8, 5]);
  });

  // A film counted twice before the cut would hand its second place to a title.
  it("counts a film acted in and directed once before the cut at 20", async () => {
    const credits = Array.from({ length: 20 }, (_, i) => film(101 + i));
    mockTMDB({
      "/search/movie": { results: [film(1)] },
      "/search/multi": { results: [person(7)] },
      "/person/7/movie_credits": { cast: credits, crew: [directed(120)] },
    });

    expect(ids((await searchAll()).body)).toEqual(credits.map((f) => f.id).reverse());
  });

  it("fills the rest of the 20 with titles, without repeats", async () => {
    const credits = Array.from({ length: 19 }, (_, i) => film(101 + i));
    mockTMDB({
      "/search/movie": { results: [film(119), film(1), film(2)] },
      "/search/multi": { results: [person(7)] },
      "/person/7/movie_credits": { cast: credits },
    });

    const films = ids((await searchAll()).body);
    expect(films).toHaveLength(20);
    expect(films.slice(0, 2)).toEqual([119, 118]);
    expect(films.at(-1)).toBe(1);
  });

  it("lists titles only when TMDB's search finds no person", async () => {
    mockTMDB({
      "/search/movie": { results: [film(1), film(2)] },
      "/search/multi": { results: [movie(1)] },
    });

    expect(ids((await searchAll()).body)).toEqual([1, 2]);
    expect(logged).not.toHaveBeenCalled();
  });
});

// Every path here is fixed or holds an id TMDB just returned, so a 404 is TMDB
// moving an endpoint: our outage, not the client's request.
describe("GET /api/movies/search, TMDB 404", () => {
  it.each([
    ["the title search", "query=dune", { "/search/movie": 404 }],
    [
      "a person's credits",
      "query=dune&type=all",
      { "/search/movie": { results: [] }, "/search/multi": { results: [person(7)] }, "/person/7/movie_credits": 404 },
    ],
  ])("on %s answers 500, logged", async (_label, query, answers) => {
    mockTMDB(answers);

    expect(await search(query)).toEqual({ status: 500, body: { error: "Failed to search films" } });
    expect(logged).toHaveBeenCalledWith("Failed to search films", expect.objectContaining({ status: 404 }));
  });
});
