import { vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabase,
  mockRequest,
  mockUser,
  readResponse,
} from "./helpers/supabase-mock";

// Mock supabase-server before importing routes
const mockGetAuthUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

// Import route handlers AFTER mocking
import { POST as addToWatchlist } from "@/app/api/watchlist/add/route";
import { DELETE as removeFromWatchlist } from "@/app/api/watchlist/remove/route";
import { GET as getWatchlist } from "@/app/api/watchlist/route";

// ─── POST /api/watchlist/add ────────────────────────

describe("POST /api/watchlist/add", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = mockRequest("POST", "/api/watchlist/add", {
      movie_id: 550,
      movie_title: "Fight Club",
      poster_path: "/poster.jpg",
    });

    const { status, json } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 when movie_id is missing", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const req = mockRequest("POST", "/api/watchlist/add", {
      movie_title: "Fight Club",
    });

    const { status } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(400);
  });

  it("returns 400 when movie_title is missing", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const req = mockRequest("POST", "/api/watchlist/add", {
      movie_id: 550,
    });

    const { status } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(400);
  });

  it.each(["not json", "null"])("returns 400 for the body %s", async (raw) => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const req = new NextRequest("http://localhost/api/watchlist/add", { method: "POST", body: raw });

    const { status, json } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  // A fraction or a negative would reach Postgres' integer column and come back as a 500.
  it.each([1.5, -5, 0, 3000000000])("returns 400 for movie_id %s", async (movie_id) => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/watchlist/add", { movie_id, movie_title: "Fight Club" });
    expect((await addToWatchlist(req)).status).toBe(400);
  });

  // The same request answers the same whether or not the film was saved before: 015's unique index keeps one row.
  it("saves with on-conflict-do-nothing and answers 201", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const supabase = createMockSupabase([{ data: null, error: null }]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/watchlist/add", {
      movie_id: 550,
      movie_title: "Fight Club",
      poster_path: { not: "a path" },
    });

    const { status, json } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(201);
    expect(json.success).toBe(true);
    const chain = supabase.from.mock.results[0].value as { upsert: ReturnType<typeof vi.fn> };
    expect(chain.upsert).toHaveBeenCalledWith(
      { user_id: mockUser.id, movie_id: 550, movie_title: "Fight Club", poster_path: null },
      { onConflict: "user_id,movie_id", ignoreDuplicates: true },
    );
  });

  it("returns 500 when the save fails", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSupabaseAdmin.mockReturnValue(createMockSupabase([{ data: null, error: { message: "boom" } }]));

    const req = mockRequest("POST", "/api/watchlist/add", { movie_id: 550, movie_title: "Fight Club" });

    const { status } = await readResponse(await addToWatchlist(req));
    expect(status).toBe(500);
    logged.mockRestore();
  });
});

// ─── DELETE /api/watchlist/remove ────────────────────

describe("DELETE /api/watchlist/remove", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = mockRequest("DELETE", "/api/watchlist/remove", {
      movie_id: 550,
    });

    const { status } = await readResponse(await removeFromWatchlist(req));
    expect(status).toBe(401);
  });

  it("returns 400 when movie_id is missing", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const req = mockRequest("DELETE", "/api/watchlist/remove", {});

    const { status } = await readResponse(await removeFromWatchlist(req));
    expect(status).toBe(400);
  });

  it.each([1.5, -5, 3000000000])("returns 400 for movie_id %s", async (movie_id) => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("DELETE", "/api/watchlist/remove", { movie_id });
    expect((await removeFromWatchlist(req)).status).toBe(400);
  });

  it.each(["not json", "null"])("returns 400 for the body %s", async (raw) => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const req = new NextRequest("http://localhost/api/watchlist/remove", { method: "DELETE", body: raw });

    const { status, json } = await readResponse(await removeFromWatchlist(req));
    expect(status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
  });

  it("returns 200 on successful removal", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const supabase = createMockSupabase([
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("DELETE", "/api/watchlist/remove", {
      movie_id: 550,
    });

    const { status, json } = await readResponse(await removeFromWatchlist(req));
    expect(status).toBe(200);
    expect(json.success).toBe(true);
  });
});

// ─── GET /api/watchlist ─────────────────────────────

describe("GET /api/watchlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = mockRequest("GET", "/api/watchlist");
    const { status } = await readResponse(await getWatchlist(req));
    expect(status).toBe(401);
  });

  it("returns the user's watchlist on success", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const films = [
      { id: "1", movie_id: 550, movie_title: "Fight Club" },
      { id: "2", movie_id: 680, movie_title: "Pulp Fiction" },
    ];
    const supabase = createMockSupabase([
      { data: films, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/watchlist");
    const { status, json } = await readResponse(await getWatchlist(req));
    expect(status).toBe(200);
    expect(json.watchlist).toEqual(films);
  });
});
