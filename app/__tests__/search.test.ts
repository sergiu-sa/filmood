import { NextRequest } from "next/server";
import { GET } from "@/app/api/movies/search/route";

/** Answers each TMDB path with its body, or with the status when it's a number. Unlisted paths 404. */
function mockTMDB(answers: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace(/^\/3/, "");
      const answer = path in answers ? answers[path] : 404;
      const status = typeof answer === "number" ? answer : 200;
      return { ok: status === 200, status, json: async () => answer };
    }),
  );
}

const film = (id: number) => ({
  id,
  title: `Film ${id}`,
  poster_path: `/${id}.jpg`,
  release_date: "2020-01-01",
  vote_average: 7,
  overview: "",
  popularity: id,
});

const searchAll = async () => {
  const res = await GET(new NextRequest("http://localhost/api/movies/search?query=dune&type=all"));
  return { status: res.status, body: await res.json() };
};

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

  it("keeps the title films when the person leg fails, and logs the failure once", async () => {
    mockTMDB({ "/search/movie": { results: [film(1), film(2)] }, "/search/person": 503 });

    const { status, body } = await searchAll();
    expect(status).toBe(200);
    expect(body.films.map((f: { id: number }) => f.id)).toEqual([1, 2]);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
