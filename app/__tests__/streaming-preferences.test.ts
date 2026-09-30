import { createMockSupabase, mockRequest, mockUser, readResponse } from "@/lib/__tests__/helpers/supabase-mock";

async function setup(user: typeof mockUser | null) {
  const supabase = createMockSupabase([{ data: null, error: null }]);
  vi.doMock("@/lib/supabase-server", () => ({
    getSupabaseAdmin: () => supabase,
    getAuthUser: async () => user,
  }));
  const route = await import("@/app/api/streaming-preferences/route");
  return { ...route, supabase };
}

describe("/api/streaming-preferences", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("saves known platforms and drops the rest", async () => {
    const { PUT, supabase } = await setup(mockUser);
    const res = await PUT(
      mockRequest("PUT", "/api/streaming-preferences", { platforms: ["Disney+", "Hulu", 42, "Netflix"] }),
    );

    expect(await readResponse(res)).toEqual({ status: 200, json: { platforms: ["Disney+", "Netflix"] } });
    const upsert = supabase.from.mock.results[0].value.upsert;
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-1", platforms: ["Disney+", "Netflix"] });
  });

  it("returns no platforms to a guest without touching the database", async () => {
    const { GET, supabase } = await setup(null);
    const res = await GET(mockRequest("GET", "/api/streaming-preferences"));

    expect(await readResponse(res)).toEqual({ status: 200, json: { platforms: [] } });
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
