import { vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabase,
  mockRequest,
  mockUser,
  readResponse,
} from "./helpers/supabase-mock";

const mockGetAuthUser = vi.fn();
const mockGetSupabaseAdmin = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

vi.mock("@/lib/group", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/group")>();
  return {
    ...actual,
    generateUniqueCode: vi.fn().mockResolvedValue("ABC123"),
  };
});

import { POST as createSession } from "@/app/api/group/create/route";
import { POST as joinSession } from "@/app/api/group/join/route";
import { GET as getSession } from "@/app/api/group/[code]/route";
import { POST as toggleReady } from "@/app/api/group/[code]/ready/route";
import { POST as startSession } from "@/app/api/group/[code]/start/route";
import { POST as kickParticipant } from "@/app/api/group/[code]/kick/route";
import { DELETE as leaveSession } from "@/app/api/group/[code]/leave/route";

function routeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

// resolveParticipant refuses a guest id that isn't a uuid before it queries.
const GUEST_ID = "0b9d3c4e-2f1a-4c8b-9e7d-6a5b4c3d2e1f";

const inserts = (supabase: ReturnType<typeof createMockSupabase>) =>
  supabase.from.mock.results.filter((r) => (r.value.insert as ReturnType<typeof vi.fn>).mock.calls.length).length;

// ─── POST /api/group/create ─────────────────────────

describe("POST /api/group/create", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/create");
    const { status } = await readResponse(await createSession(req));
    expect(status).toBe(401);
  });

  it("returns 201 with code, sessionId, and participantId", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);

    const supabase = createMockSupabase([
      { data: { id: "session-1", code: "ABC123" }, error: null },
      { data: { id: "part-1" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/create");
    const { status, json } = await readResponse(await createSession(req));
    expect(status).toBe(201);
    expect(json.code).toBe("ABC123");
    expect(json.sessionId).toBe("session-1");
    expect(json.participantId).toBe("part-1");
  });
});

// ─── POST /api/group/join ───────────────────────────

describe("POST /api/group/join", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid code format", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/join", { code: "AB", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 400 when guest has no nickname", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/join", { code: "ABC123" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 400 when a guest's nickname is only spaces", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "   " });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 400 when nickname is too short", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "A" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 400 when nickname is too long", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "A".repeat(21) });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 400 for a body that isn't JSON", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = new NextRequest("http://localhost/api/group/join", { method: "POST", body: "{" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns 404 when no session has the code, read with maybeSingle", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([{ data: null, error: null }]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "XXXXXX", nickname: "Guest" });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(404);
    expect(json.error).toBe("Session not found. Check the code and try again.");
  });

  it("answers a failed session read with 500, not 404", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([{ data: null, error: { code: "57014", message: "timeout" } }]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(500);
  });

  it("answers a failed participant count with 500, rather than skip the cap", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: { code: "57014", message: "timeout" }, count: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(500);
    expect(inserts(supabase)).toBe(0);
  });

  it("returns 410 when session is expired", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: fiveHoursAgo }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(410);
  });

  it("returns 400 when session is not in lobby", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("gives a guest their seat back mid-game, under the name the others have seen", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", created_at: new Date().toISOString() }, error: null },
      { data: { id: GUEST_ID }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Other name", participantId: GUEST_ID });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe(GUEST_ID);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("gives a signed-in player their seat back mid-game", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: { id: "part-1" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123" });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe("part-1");
    expect(inserts(supabase)).toBe(0);
  });

  it.each([
    ["a guest whose stored id has no seat", null, { participantId: GUEST_ID, nickname: "Guest" }],
    ["a signed-in user with no seat", mockUser, {}],
  ])("still refuses %s once the session has started", async (_, user, body) => {
    mockGetAuthUser.mockResolvedValue(user);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", ...body });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
    expect(json.error).toBe("This session has already started");
    expect(inserts(supabase)).toBe(0);
  });

  it("returns 400 when session is full", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: null, count: 10 },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(400);
  });

  it("returns existing participant when auth user re-joins, even into a full session", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "part-1" }, error: null },
      { data: null, error: null, count: 8 },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123" });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe("part-1");
    expect(inserts(supabase)).toBe(0);
  });

  it("answers a join that loses the race to the same user's other join with the seat that one made", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: null },
      { data: null, error: null, count: 3 },
      { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } },
      { data: { id: "part-1" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123" });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe("part-1");
    const readBack = supabase.from.mock.results[4].value;
    expect(readBack.eq).toHaveBeenCalledWith("session_id", "s-1");
    expect(readBack.eq).toHaveBeenCalledWith("user_id", mockUser.id);
  });

  it("gives a guest who joins again with their stored id the same seat, under the name just typed", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: GUEST_ID }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: " Sergiu ", participantId: GUEST_ID });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe(GUEST_ID);
    expect(inserts(supabase)).toBe(0);

    const seat = supabase.from.mock.results[1].value;
    expect(seat.eq).toHaveBeenCalledWith("id", GUEST_ID);
    expect(seat.is).toHaveBeenCalledWith("user_id", null);
    const rename = supabase.from.mock.results[2].value;
    expect(rename.update).toHaveBeenCalledWith({ nickname: "Sergiu" });
    expect(rename.eq).toHaveBeenCalledWith("id", GUEST_ID);
  });

  it("answers a failed rename with 500", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: GUEST_ID }, error: null },
      { data: null, error: { code: "57014", message: "timeout" } },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Sergiu", participantId: GUEST_ID });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(500);
  });

  it.each([
    // A uuid is looked up; anything else is refused before the query.
    ["isn't a seat in this session", GUEST_ID, [{ data: null, error: null }], 4],
    ["isn't a uuid", "p-other-session", [], 3],
  ])("seats a guest whose stored id %s", async (_, participantId, seatRead, queries) => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      ...seatRead,
      { data: null, error: null, count: 3 },
      { data: { id: "part-new" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest", participantId });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe("part-new");
    expect(inserts(supabase)).toBe(1);
    expect(supabase.from).toHaveBeenCalledTimes(queries);
  });

  it("answers a failed seat read with 500 instead of seating them again", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: { code: "57014", message: "timeout" } },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest", participantId: GUEST_ID });
    const { status } = await readResponse(await joinSession(req));
    expect(status).toBe(500);
    expect(inserts(supabase)).toBe(0);
  });

  it("creates new participant for guest", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: null, count: 3 },
      { data: { id: "part-new" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/join", { code: "ABC123", nickname: "Guest" });
    const { status, json } = await readResponse(await joinSession(req));
    expect(status).toBe(200);
    expect(json.participantId).toBe("part-new");
    expect(json.code).toBe("ABC123");
  });
});

// ─── GET /api/group/[code] ──────────────────────────

describe("GET /api/group/[code]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid code", async () => {
    const supabase = createMockSupabase([]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/AB");
    const { status } = await readResponse(await getSession(req, routeParams("AB")));
    expect(status).toBe(400);
  });

  it("returns session and participants on success", async () => {
    const session = { id: "s-1", code: "ABC123", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() };
    const participants = [{ id: "p-1", nickname: "Sergiu", user_id: "user-1", is_ready: true }];

    const supabase = createMockSupabase([
      { data: session, error: null },
      { data: participants, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123");
    const { status, json } = await readResponse(await getSession(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.session.code).toBe("ABC123");
    expect(json.participants).toHaveLength(1);
  });

  // Anyone with the code can call this, and the mood page promises no one sees who picked what.
  it("says who has locked in, never what they picked", async () => {
    const session = { id: "s-1", code: "ABC123", host_id: "user-1", status: "mood", created_at: new Date().toISOString() };
    const participants = [
      { id: "p-1", nickname: "Sergiu", user_id: "user-1", mood_selections: ["laugh"] },
      { id: "p-2", nickname: "Guest", user_id: null, mood_selections: null },
      { id: "p-3", nickname: "Late", user_id: null, mood_selections: [] },
    ];
    mockGetSupabaseAdmin.mockReturnValue(
      createMockSupabase([
        { data: session, error: null },
        { data: participants, error: null },
      ]),
    );

    const req = mockRequest("GET", "/api/group/ABC123");
    const { json } = await readResponse(await getSession(req, routeParams("ABC123")));
    expect(json.participants.map((p: { has_submitted: boolean }) => p.has_submitted)).toEqual([true, false, false]);
    for (const p of json.participants) expect(p).not.toHaveProperty("mood_selections");
    expect(json.participants[0]).toMatchObject({ id: "p-1", nickname: "Sergiu", user_id: "user-1" });
  });

  // The lobby reads a 404 after it has loaded as a disband, so a failed read must not be one.
  it("answers a failed session read with 500, not 404", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetSupabaseAdmin.mockReturnValue(createMockSupabase([{ data: null, error: { message: "timeout" } }]));

    const req = mockRequest("GET", "/api/group/ABC123");
    const { status } = await readResponse(await getSession(req, routeParams("ABC123")));
    expect(status).toBe(500);
  });

  // .single() reports no row as an error (PGRST116), which would now read as a 500.
  it("answers 404 when no session has the code, read with maybeSingle", async () => {
    const supabase = createMockSupabase([{ data: null, error: null }]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123");
    const { status } = await readResponse(await getSession(req, routeParams("ABC123")));
    expect(status).toBe(404);
    expect(supabase.from.mock.results[0].value.maybeSingle).toHaveBeenCalled();
  });
});

// ─── POST /api/group/[code]/ready ───────────────────

describe("POST /api/group/[code]/ready", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toggles ready state and returns new value", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", is_ready: false }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/ready", {});
    const { status, json } = await readResponse(await toggleReady(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.is_ready).toBe(true);
  });

  it("answers a failed participant read with 500, not 'You are not in this session'", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: { code: "57014", message: "timeout" } },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/ready", {});
    const { status } = await readResponse(await toggleReady(req, routeParams("ABC123")));
    expect(status).toBe(500);
  });

  it.each([
    ["a long string", "x".repeat(100_000)],
    ["an array holding one", ["x".repeat(100_000)]],
    // The filter would stringify it to the uuid and match that guest's seat.
    ["an array holding a guest's uuid", [GUEST_ID]],
    ["a uuid with more after it", `${GUEST_ID}x`],
    ["a uuid with more before it", `x${GUEST_ID}`],
  ])("refuses a guest id that is %s without asking the database", async (_, participantId) => {
    mockGetAuthUser.mockResolvedValue(null);
    // What a query would get: for the long ids, Supabase's gateway answers 414 with no error code.
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: { message: "URI Too Long" } },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/ready", { participantId });
    const { status } = await readResponse(await toggleReady(req, routeParams("ABC123")));
    expect(status).toBe(403);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it("returns 400 when session is not in lobby", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/ready", {});
    const { status } = await readResponse(await toggleReady(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });
});

// ─── POST /api/group/[code]/start ───────────────────

describe("POST /api/group/[code]/start", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/ABC123/start");
    const { status } = await readResponse(await startSession(req, routeParams("ABC123")));
    expect(status).toBe(401);
  });

  it("returns 403 when non-host tries to start", async () => {
    mockGetAuthUser.mockResolvedValue({ ...mockUser, id: "other-user" });
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/start");
    const { status } = await readResponse(await startSession(req, routeParams("ABC123")));
    expect(status).toBe(403);
  });

  it("returns 400 when fewer than 2 participants", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: [{ id: "p-1", is_ready: true }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/start");
    const { status } = await readResponse(await startSession(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when participants are not all ready", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: [{ id: "p-1", is_ready: true }, { id: "p-2", is_ready: false }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/start");
    const { status } = await readResponse(await startSession(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("transitions session to mood phase on success", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: [{ id: "p-1", is_ready: true }, { id: "p-2", is_ready: true }], error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/start");
    const { status, json } = await readResponse(await startSession(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.status).toBe("mood");
  });
});

// ─── POST /api/group/[code]/kick ────────────────────

describe("POST /api/group/[code]/kick", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("POST", "/api/group/ABC123/kick", { participantId: "p-2" });
    const { status } = await readResponse(await kickParticipant(req, routeParams("ABC123")));
    expect(status).toBe(401);
  });

  it("returns 400 when participantId is missing", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/kick", {});
    const { status } = await readResponse(await kickParticipant(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 403 when non-host tries to kick", async () => {
    mockGetAuthUser.mockResolvedValue({ ...mockUser, id: "other-user" });
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/kick", { participantId: "p-2" });
    const { status } = await readResponse(await kickParticipant(req, routeParams("ABC123")));
    expect(status).toBe(403);
  });

  it("returns 400 when host tries to kick themselves", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", user_id: "user-1" }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/kick", { participantId: "p-1" });
    const { status } = await readResponse(await kickParticipant(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("kicks another participant successfully", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-2", user_id: "other-user" }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/kick", { participantId: "p-2" });
    const { status, json } = await readResponse(await kickParticipant(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.kicked).toBe(true);
  });
});

// ─── DELETE /api/group/[code]/leave ─────────────────

describe("DELETE /api/group/[code]/leave", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when session is not in lobby", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "swiping", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("DELETE", "/api/group/ABC123/leave", {});
    const { status } = await readResponse(await leaveSession(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("disbands session when host leaves", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", user_id: "user-1" }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("DELETE", "/api/group/ABC123/leave", {});
    const { status, json } = await readResponse(await leaveSession(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.disbanded).toBe(true);
  });

  // Every row id is visible to anyone with the code, so a guest id must not stand for the host's row.
  it("matches a guest id against guest rows only, so the host's row id can't disband the session", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const hostRowId = "1e2d3c4b-5a69-4f87-8e9d-0a1b2c3d4e5f";
    const req = mockRequest("DELETE", "/api/group/ABC123/leave", { participantId: hostRowId });
    const { status } = await readResponse(await leaveSession(req, routeParams("ABC123")));
    const participantQuery = supabase.from.mock.results[1].value;
    expect(participantQuery.eq).toHaveBeenCalledWith("id", hostRowId);
    expect(participantQuery.is).toHaveBeenCalledWith("user_id", null);
    expect(status).toBe(403);
    expect(supabase.from).toHaveBeenCalledTimes(2);
  });

  it("removes participant when non-host leaves", async () => {
    mockGetAuthUser.mockResolvedValue({ ...mockUser, id: "other-user" });
    const supabase = createMockSupabase([
      { data: { id: "s-1", host_id: "user-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-2", user_id: "other-user" }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("DELETE", "/api/group/ABC123/leave", {});
    const { status, json } = await readResponse(await leaveSession(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.left).toBe(true);
  });
});
