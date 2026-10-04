import { vi } from "vitest";
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

const mockBuildSharedDeck = vi.fn();

vi.mock("@/lib/deck", () => ({
  buildSharedDeck: (...args: unknown[]) => mockBuildSharedDeck(...args),
}));

const mockGroupProviders = vi.fn();

vi.mock("@/lib/watchProviders", () => ({
  groupProviders: (...args: unknown[]) => mockGroupProviders(...args),
}));

const mockRecordMoodPicks = vi.fn();

vi.mock("@/lib/mood-history", () => ({
  recordMoodPicks: (...args: unknown[]) => mockRecordMoodPicks(...args),
}));

// Next runs after() callbacks once the response is sent; tests run them by hand.
const afterCallbacks: (() => unknown)[] = [];

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => {
    afterCallbacks.push(callback);
  },
}));

const defaultDeck = [
  { id: 1, title: "Film 1", poster_path: "/p1.jpg", release_date: "2025-01-01", vote_average: 7.5, overview: "Overview", genre_ids: [35], mood_keys: ["laugh"] },
  { id: 2, title: "Film 2", poster_path: "/p2.jpg", release_date: "2025-01-01", vote_average: 8.0, overview: "Overview", genre_ids: [18], mood_keys: ["cry"] },
];

import { POST as submitMood } from "@/app/api/group/[code]/mood/route";
import { GET as getSwipeState, POST as submitSwipe } from "@/app/api/group/[code]/swipe/route";
import { GET as getResults } from "@/app/api/group/[code]/results/route";

function routeParams(code: string) {
  return { params: Promise.resolve({ code }) };
}

const fakeDeck = [
  { id: 1, title: "Film 1", poster_path: "/p1.jpg", release_date: "2025-01-01", vote_average: 7.5, overview: "Overview", genre_ids: [35], mood_keys: ["laugh"] },
  { id: 2, title: "Film 2", poster_path: "/p2.jpg", release_date: "2025-01-01", vote_average: 8.0, overview: "Overview", genre_ids: [18], mood_keys: ["cry"] },
];

// ─── POST /api/group/[code]/mood ────────────────────

describe("POST /api/group/[code]/mood", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    mockBuildSharedDeck.mockResolvedValue(defaultDeck);
    mockGroupProviders.mockResolvedValue([]);
    mockRecordMoodPicks.mockResolvedValue(1);
  });

  const inMood = { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null };
  const notSubmitted = { data: { id: "p-1", mood_selections: null }, error: null };
  const ok = { data: null, error: null };

  // Session, participant, the update, everyone's picks; then, if the deck fails, the status re-read and the rollback.
  async function lockIn(body: Record<string, unknown>, everyone: unknown[] = [{ mood_selections: ["laugh"] }, { mood_selections: null }]) {
    const supabase = createMockSupabase([inMood, notSubmitted, ok, { data: everyone, error: null }, { data: { status: "mood" }, error: null }, ok]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);
    const req = mockRequest("POST", "/api/group/ABC123/mood", body);
    const res = await readResponse(await submitMood(req, routeParams("ABC123")));
    const update = supabase.from.mock.results[2].value.update.mock.calls[0]?.[0];
    return { ...res, supabase, update };
  }

  it("refuses more than two tile moods, before touching the database", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);
    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["laugh", "cry", "dark"] });
    expect(await readResponse(await submitMood(req, routeParams("ABC123")))).toEqual({
      status: 400,
      json: { error: "Pick up to two moods." },
    });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // Discover's order: tiles first, then the text's moods, two in all.
  it("keeps the tile first when the text adds more moods", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const { status, update } = await lockIn({ moods: ["cry"], text: "funny dark" });
    expect(status).toBe(200);
    expect(update.mood_selections).toEqual(["cry", "laugh"]);
  });

  it.each([
    [{ time: "medium" }, "medium"],
    [{ tempo: "slowburn" }, "long"],
    [{ tempo: "fastpaced" }, "short"],
    [{ time: "short", tempo: "slowburn" }, "short"],
    [{ text: "slow burn" }, "long"],
    [{ time: "medium", text: "slow burn" }, "medium"],
    [{ time: "constructor" }, null],
    [{}, null],
  ])("stores time %o as %s, and never a tempo", async (extra, time) => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const { update } = await lockIn({ moods: ["laugh"], ...extra });
    expect(update.time).toBe(time);
    expect(update).not.toHaveProperty("tempo");
  });

  it("stores at most 120 characters of text", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const { update } = await lockIn({ moods: ["laugh"], text: `funny ${"x".repeat(200)}` });
    expect(update.mood_text).toHaveLength(120);
  });

  it("asks for a feeling word when the text only set a length or an era", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/mood", { text: "80s" });
    expect(await readResponse(await submitMood(req, routeParams("ABC123")))).toEqual({
      status: 400,
      json: { error: "Add a feeling word — like 'funny', 'dark', or 'cozy'. A length or an era alone isn't enough." },
    });
  });

  it("records a signed-in participant's stored moods after the response", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const { json, supabase } = await lockIn({ moods: ["cry"], text: "funny dark" });
    expect(json.allDone).toBe(false);
    expect(mockRecordMoodPicks).not.toHaveBeenCalled();
    expect(afterCallbacks).toHaveLength(1);
    await afterCallbacks[0]();
    expect(mockRecordMoodPicks).toHaveBeenCalledWith(supabase, "user-1", ["cry", "laugh"]);
  });

  it("records nothing for a guest", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const { status } = await lockIn({ moods: ["laugh"], participantId: "p-1" });
    expect(status).toBe(200);
    expect(afterCallbacks).toHaveLength(0);
  });

  it("builds the deck on the signed-in participants' services", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    mockGroupProviders.mockResolvedValue([8, 76]);
    const everyone = [
      { mood_selections: ["laugh"], user_id: "user-1" },
      { mood_selections: ["cry"], user_id: null },
      { mood_selections: ["dark"], user_id: "user-2" },
    ];
    const { json, supabase } = await lockIn({ moods: ["laugh"] }, everyone);
    expect(json.allDone).toBe(true);
    expect(mockGroupProviders).toHaveBeenCalledWith(supabase, ["user-1", "user-2"]);
    expect(mockBuildSharedDeck).toHaveBeenCalledWith(everyone, [8, 76]);
    expect(afterCallbacks).toHaveLength(1);
  });

  // Like a TMDB outage: the form comes back and a retry reads the services again.
  it("rolls the submission back when the services can't be read", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    mockGroupProviders.mockRejectedValue(new Error("permission denied"));
    const { status, supabase } = await lockIn({ moods: ["laugh"] }, [{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }]);
    expect(status).toBe(500);
    expect(mockBuildSharedDeck).not.toHaveBeenCalled();
    const rollback = supabase.from.mock.results[5].value.update.mock.calls[0][0];
    expect(rollback).toEqual({ mood_selections: null });
    expect(afterCallbacks).toHaveLength(0);
  });

  it("returns 400 when moods array is empty", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: [] });
    const { status } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when no valid moods provided", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["invalid_mood", "another_bad"] });
    const { status } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when session is not in mood phase", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["laugh"] });
    const { status } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 409 when moods already submitted", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", mood_selections: ["laugh"] }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["cry"] });
    const { status } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(409);
  });

  it("saves moods and returns allDone:false when not all submitted", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", mood_selections: null }, error: null },
      { data: null, error: null },
      { data: [{ mood_selections: ["laugh"] }, { mood_selections: null }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["laugh"] });
    const { status, json } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.submitted).toBe(true);
    expect(json.allDone).toBe(false);
  });

  it("builds deck and returns allDone:true when all submitted", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", mood_selections: null }, error: null },
      { data: null, error: null },
      { data: [{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }], error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["laugh"] });
    const { status, json } = await readResponse(await submitMood(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.allDone).toBe(true);
    expect(json.deckSize).toBeGreaterThan(0);
  });

  // A TMDB outage during the final submit used to commit the participant's
  // moods and then 500, leaving them behind the "already submitted" guard with
  // no deck and no way to retry — the session was wedged for everyone.
  it("rolls the submission back when the deck build fails", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    mockBuildSharedDeck.mockRejectedValue(new Error("TMDB responded 429"));
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", mood_selections: null }, error: null },
      { data: null, error: null },
      { data: [{ mood_selections: ["laugh"] }, { mood_selections: ["cry"] }], error: null },
      // The rollback re-reads the session first, so it only fires while the
      // session is still in "mood" and a concurrent submitter hasn't moved on.
      { data: { status: "mood" }, error: null },
      { data: null, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/mood", { moods: ["laugh"] });
    const { status } = await readResponse(await submitMood(req, routeParams("ABC123")));

    expect(status).toBe(500);
    // Call count, not "was it ever called": the handler already touches
    // session_participants three times before the deck build, so a
    // toHaveBeenCalledWith check stays green with the rollback deleted.
    const participantWrites = supabase.from.mock.calls.filter(
      (c: unknown[]) => c[0] === "session_participants",
    );
    expect(participantWrites).toHaveLength(4);
    // A rolled-back submission isn't a pick; the retry would record it twice.
    expect(afterCallbacks).toHaveLength(0);
  });
});

// ─── GET /api/group/[code]/swipe ────────────────────

describe("GET /api/group/[code]/swipe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when session is not in swiping or done phase", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "mood", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/swipe");
    const { status } = await readResponse(await getSwipeState(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns swipe state for swiping session", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", has_swiped: false }, error: null },
      { data: [{ movie_id: 1, vote: "yes" }], error: null },
      { data: [{ id: "p-1", user_id: "user-1", nickname: "Sergiu", has_swiped: false }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/swipe");
    const { status, json } = await readResponse(await getSwipeState(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.sessionId).toBe("s-1");
    expect(json.deck).toHaveLength(2);
    expect(json.swipes).toHaveLength(1);
    expect(json.sessionStatus).toBe("swiping");
  });

  it("returns swipe state for done session", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "done", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", has_swiped: true }, error: null },
      { data: [], error: null },
      { data: [{ id: "p-1", user_id: "user-1", nickname: "Sergiu", has_swiped: true }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/swipe");
    const { status, json } = await readResponse(await getSwipeState(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.sessionStatus).toBe("done");
  });
});

// ─── POST /api/group/[code]/swipe ───────────────────

describe("POST /api/group/[code]/swipe", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid vote value", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/swipe", { movieId: 1, vote: "love" });
    const { status } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when movieId is missing", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const req = mockRequest("POST", "/api/group/ABC123/swipe", { vote: "yes" });
    const { status } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when session is not in swiping phase", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "lobby", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/swipe", { movieId: 1, vote: "yes" });
    const { status } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 400 when movie is not in deck", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/swipe", { movieId: 9999, vote: "yes" });
    const { status } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 409 when participant already finished swiping", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", has_swiped: true }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/swipe", { movieId: 1, vote: "yes" });
    const { status } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(409);
  });

  it("records vote and returns progress on success", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", status: "swiping", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: { id: "p-1", has_swiped: false }, error: null },
      { data: null, error: null },
      { data: null, error: null, count: 1 },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("POST", "/api/group/ABC123/swipe", { movieId: 1, vote: "yes" });
    const { status, json } = await readResponse(await submitSwipe(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.recorded).toBe(true);
    expect(json.progress.swiped).toBe(1);
  });
});

// ─── GET /api/group/[code]/results ──────────────────

describe("GET /api/group/[code]/results", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no auth and no participantId", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const req = mockRequest("GET", "/api/group/ABC123/results");
    const { status } = await readResponse(await getResults(req, routeParams("ABC123")));
    expect(status).toBe(401);
  });

  it("returns 400 when session is not done", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const supabase = createMockSupabase([
      { data: { id: "s-1", code: "ABC123", status: "swiping", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/results");
    const { status } = await readResponse(await getResults(req, routeParams("ABC123")));
    expect(status).toBe(400);
  });

  it("returns 403 when caller is not a participant", async () => {
    mockGetAuthUser.mockResolvedValue({ ...mockUser, id: "outsider" });
    const supabase = createMockSupabase([
      { data: { id: "s-1", code: "ABC123", status: "done", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: [{ id: "p-1", user_id: "user-1", nickname: "Sergiu" }], error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/results");
    const { status } = await readResponse(await getResults(req, routeParams("ABC123")));
    expect(status).toBe(403);
  });

  it("returns tiered results with topPick on success", async () => {
    mockGetAuthUser.mockResolvedValue(mockUser);
    const participants = [
      { id: "p-1", user_id: "user-1", nickname: "Sergiu" },
      { id: "p-2", user_id: "user-2", nickname: "Alex" },
    ];
    const swipes = [
      { participant_id: "p-1", movie_id: 1, vote: "yes" },
      { participant_id: "p-2", movie_id: 1, vote: "yes" },
      { participant_id: "p-1", movie_id: 2, vote: "no" },
      { participant_id: "p-2", movie_id: 2, vote: "maybe" },
    ];

    const supabase = createMockSupabase([
      { data: { id: "s-1", code: "ABC123", status: "done", movie_deck: fakeDeck, created_at: new Date().toISOString() }, error: null },
      { data: participants, error: null },
      { data: swipes, error: null },
    ]);
    mockGetSupabaseAdmin.mockReturnValue(supabase);

    const req = mockRequest("GET", "/api/group/ABC123/results");
    const { status, json } = await readResponse(await getResults(req, routeParams("ABC123")));
    expect(status).toBe(200);
    expect(json.participantCount).toBe(2);
    expect(json.perfect.length).toBe(1);
    expect(json.perfect[0].movie.id).toBe(1);
    expect(json.miss.length).toBe(1);
    expect(json.topPick.movie.id).toBe(1);
  });
});
