import { createMockSupabase, mockRequest, mockUser } from "@/lib/__tests__/helpers/supabase-mock";
import { GET } from "@/app/api/profile/fingerprint/route";

const mockGetSupabaseAdmin = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  getAuthUser: async () => mockUser,
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

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

const fingerprint = async () => {
  mockGetSupabaseAdmin.mockReturnValue(
    createMockSupabase([
      { data: [{ mood: "laugh" }, { mood: "laugh" }, { mood: "cry" }], error: null },
      { data: [{ movie_id: 1 }, { movie_id: 2 }, { movie_id: 3 }], error: null },
    ]),
  );
  const res = await GET(mockRequest("GET", "/api/profile/fingerprint"));
  return { status: res.status, body: await res.json() };
};

const topMoods = [
  { mood: "laugh", count: 2 },
  { mood: "cry", count: 1 },
];

let logged: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.TMDB_API_KEY = "test-key";
  logged = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  logged.mockRestore();
});

describe("GET /api/profile/fingerprint", () => {
  // The moods come from Postgres, so a TMDB outage costs the genres only.
  it("keeps the moods when every genre lookup fails, logging every failure once", async () => {
    mockTMDB({ "/movie/1": 503, "/movie/2": 429, "/movie/3": 503 });

    expect(await fingerprint()).toEqual({ status: 200, body: { topMoods, topGenres: [] } });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][1]).toHaveLength(3);
  });

  it("counts the genres that came back, logging the failures once", async () => {
    mockTMDB({ "/movie/1": { genres: [{ id: 35 }] }, "/movie/2": 429, "/movie/3": 503 });

    expect(await fingerprint()).toEqual({
      status: 200,
      body: { topMoods, topGenres: [{ id: 35, name: "Comedy", count: 1 }] },
    });
    expect(logged).toHaveBeenCalledTimes(1);
    expect(logged.mock.calls[0][1]).toEqual([
      expect.objectContaining({ status: 429 }),
      expect.objectContaining({ status: 503 }),
    ]);
  });
});
