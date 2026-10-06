import { createMockSupabase, mockRequest, mockUser } from "@/lib/__tests__/helpers/supabase-mock";

async function setup(user: typeof mockUser | null) {
  const supabase = createMockSupabase();
  // Next runs after() callbacks once the response is sent; tests run them by hand.
  const afterCallbacks: (() => unknown)[] = [];
  vi.doMock("next/server", async (importOriginal) => ({
    ...(await importOriginal<typeof import("next/server")>()),
    after: (callback: () => unknown) => {
      afterCallbacks.push(callback);
    },
  }));
  vi.doMock("@/lib/supabase-server", () => ({
    getSupabaseAdmin: () => supabase,
    getAuthUser: async () => user,
  }));
  const getFilmDetail = vi.fn(async (id: number) => ({ id, title: "Looked-up title", poster_path: "/looked-up.jpg" }));
  vi.doMock("@/lib/filmData", () => ({ getFilmDetail }));
  const { POST } = await import("@/app/api/film-views/route");
  const post = (body: Record<string, unknown>) => POST(mockRequest("POST", "/api/film-views", body));
  return { post, afterCallbacks, supabase, getFilmDetail };
}

describe("POST /api/film-views", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("refuses a guest and schedules nothing", async () => {
    const { post, afterCallbacks } = await setup(null);
    const res = await post({ movie_id: 7 });

    expect(res.status).toBe(401);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("rejects an id that isn't a TMDB id", async () => {
    const { post, afterCallbacks } = await setup(mockUser);
    const res = await post({ movie_id: "abc" });

    expect(res.status).toBe(400);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("answers 204, then stores the looked-up title rather than the client's", async () => {
    const { post, afterCallbacks, supabase, getFilmDetail } = await setup(mockUser);
    const res = await post({ movie_id: 7, movie_title: "Client title", poster_path: "/client.jpg" });

    expect(res.status).toBe(204);
    expect(afterCallbacks).toHaveLength(1);
    expect(supabase.from).not.toHaveBeenCalled();

    await afterCallbacks[0]();
    expect(getFilmDetail).toHaveBeenCalledWith(7);
    const insert = supabase.from.mock.results[0].value.insert;
    expect(insert).toHaveBeenCalledWith({
      user_id: "user-1",
      movie_id: 7,
      movie_title: "Looked-up title",
      poster_path: "/looked-up.jpg",
    });
  });

  it("records nothing when the film lookup fails, and logs it", async () => {
    const { post, afterCallbacks, supabase, getFilmDetail } = await setup(mockUser);
    const missing = new Error("TMDB responded 404 for /movie/7");
    getFilmDetail.mockRejectedValueOnce(missing);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await post({ movie_id: 7 });
    await afterCallbacks[0]();

    expect(supabase.from).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("Film view not recorded", missing);
    consoleError.mockRestore();
  });
});
