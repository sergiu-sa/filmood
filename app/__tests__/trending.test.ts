import { GET } from "@/app/api/movies/trending/route";
import { mockTMDB } from "@/lib/__tests__/helpers/tmdb-mock";

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.TMDB_API_KEY = "test-key";
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("GET /api/movies/trending", () => {
  // A fixed path: a 404 is TMDB moving the endpoint, our outage.
  it("answers a TMDB 404 with a 500, logged", async () => {
    mockTMDB({ "/trending/movie/day": 404 });

    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to fetch trending films" });
    expect(logged).toHaveBeenCalledWith("Failed to fetch trending films", expect.objectContaining({ status: 404 }));
  });
});
