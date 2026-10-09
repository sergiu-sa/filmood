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
    mockTMDB({ "/search/movie": 404, "/search/person": 503 });

    expect((await searchAll()).status).toBe(500);
    expect(logged).toHaveBeenCalledTimes(2);
    expect(logged).toHaveBeenCalledWith("Failed to search films", expect.objectContaining({ status: 503 }));
  });

  // The title leg answered, so "every leg rejected" would call this "no hits".
  it("answers 500 when one leg finds nothing and the other is down", async () => {
    mockTMDB({ "/search/movie": { results: [] }, "/search/person": 503 });

    expect((await searchAll()).status).toBe(500);
  });

  it("keeps the title films when the person leg fails, and logs the failure once", async () => {
    mockTMDB({ "/search/movie": { results: [film(1), film(2)] }, "/search/person": 503 });

    const { status, body } = await searchAll();
    expect(status).toBe(200);
    expect(body.films.map((f: { id: number }) => f.id)).toEqual([1, 2]);
    expect(logged).toHaveBeenCalledTimes(1);
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
      { "/search/movie": { results: [] }, "/search/person": { results: [{ id: 7 }] }, "/person/7/movie_credits": 404 },
    ],
  ])("on %s answers 500, logged", async (_label, query, answers) => {
    mockTMDB(answers);

    expect(await search(query)).toEqual({ status: 500, body: { error: "Failed to search films" } });
    expect(logged).toHaveBeenCalledWith("Failed to search films", expect.objectContaining({ status: 404 }));
  });
});
