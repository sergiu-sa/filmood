/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import GroupSwipePage from "@/app/group/[code]/swipe/page";
import type { DeckFilm } from "@/lib/types";

// One object each across renders: the page refetches whenever `router` or `user` changes.
const { router, auth } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  auth: { user: { id: "u1" }, loading: false },
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "K7F2AB" }),
  useRouter: () => router,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth }));
// The id SessionJoin stored in localStorage, which it does for signed-in players too.
let storedId: string | null = null;
vi.mock("@/lib/useParticipantId", () => ({ useParticipantId: () => ({ participantId: storedId, ready: true }) }));
// Off: getSession() came back empty, as when an expired token can't refresh.
let withToken = true;
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () =>
    withToken ? { "Content-Type": "application/json", Authorization: "Bearer t" } : { "Content-Type": "application/json" },
}));
// The page's refetch, as Realtime or the 2s poll would call it.
let poll: () => Promise<void> = async () => {};
vi.mock("@/lib/useGroupRealtime", () => ({
  useGroupRealtime: ({ onUpdate }: { onUpdate: () => Promise<void> }) => {
    poll = onUpdate;
  },
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));

// Fifteen films; "Card n" is the film at deck position n.
const deck: DeckFilm[] = Array.from({ length: 15 }, (_, n) => ({
  id: 100 + n,
  title: `Card ${n}`,
  overview: "",
  poster_path: null,
  release_date: "2010-01-01",
  vote_average: 7,
  genre_ids: [],
  mood_keys: [],
}));

// This player's votes by deck position, in the order the server lists them.
let votedPositions: number[] = [];
const players = (hostDone: boolean, guestDone: boolean) => [
  { id: "p1", user_id: "u1", nickname: "Host", has_swiped: hostDone },
  { id: "p2", user_id: null, nickname: "Guest", has_swiped: guestDone },
];
let participants = players(false, true);
let sessionStatus = "swiping";
const swipeState = () =>
  Response.json({
    sessionId: "s1",
    hostId: "u1",
    deck,
    swipes: votedPositions.map((n) => ({ movie_id: deck[n].id, vote: "yes" })),
    progress: { swiped: votedPositions.length, total: deck.length },
    participants,
    sessionStatus,
  });

const recorded = async () => Response.json({ recorded: true, participantDone: false, allDone: false });
let answerGet: () => Promise<Response> = async () => swipeState();
const failed = async () => Response.json({ error: "Failed to record vote" }, { status: 500 });
let answerPost: (movieId: number) => Promise<Response> = recorded;
const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
  if (init?.method === "POST") return answerPost(JSON.parse(String(init.body)).movieId);
  if (init?.method === "PATCH") {
    participants = participants.filter((p) => p.has_swiped);
    sessionStatus = "done";
    return Response.json({ removed: 1 });
  }
  return answerGet();
});
vi.stubGlobal("fetch", fetchMock);

const postedIds = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)).movieId);
const press = () => fireEvent.keyDown(window, { key: "ArrowRight" });
// Room past each vote's 380 ms exit when the whole suite runs at once.
const slow = { timeout: 3000 };

describe("Group swipe page", () => {
  afterEach(() => {
    votedPositions = [];
    participants = players(false, true);
    sessionStatus = "swiping";
    answerGet = async () => swipeState();
    answerPost = recorded;
    fetchMock.mockClear();
    router.push.mockClear();
    storedId = null;
    withToken = true;
  });

  it("resumes at the first card without a vote and steps over the ones already voted", async () => {
    // A refresh after two cards were skipped: 10 and 13 have no vote.
    votedPositions = [14, 12, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    render(<GroupSwipePage />);

    await screen.findByText("Card 10");
    press();
    await screen.findByText("Card 13");
    press();
    await screen.findByRole("heading", { name: "All films rated" });

    expect(postedIds()).toEqual([deck[10].id, deck[13].id]);
  });

  it("starts the deck only once its films and votes are in, after a failed first load", async () => {
    answerGet = async () => Response.json({ error: "Failed to load swipe state" }, { status: 500 });
    render(<GroupSwipePage />);
    await screen.findByText("Failed to load swipe state");

    // The poll clears the error and renders before its own GET answers.
    votedPositions = [0];
    let answer!: (r: Response) => void;
    answerGet = () => new Promise((r) => (answer = r));
    await act(async () => {
      void poll();
    });
    answer(swipeState());

    expect(await screen.findByText("Card 1")).toBeInTheDocument();
    expect(screen.queryByText("Card 0")).toBeNull();
  });

  it("puts the last card back when its vote fails twice", async () => {
    votedPositions = Array.from({ length: 14 }, (_, n) => n);
    answerPost = failed;
    render(<GroupSwipePage />);

    await screen.findByText("Card 14");
    press();
    // The vote's 380 ms exit, then the POST and one retry 800 ms later.
    await waitFor(() => expect(postedIds()).toEqual([deck[14].id, deck[14].id]), slow);
    expect(await screen.findByText("Card 14")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "All films rated" })).toBeNull();
    expect(screen.getByText("Your vote on Card 14 didn't save, so it's back in the deck.")).toBeInTheDocument();
  });

  it("offers a card whose vote failed after the last one, and finishes once it saves", async () => {
    votedPositions = Array.from({ length: 12 }, (_, n) => n);
    answerPost = (id) => (id === deck[12].id ? failed() : recorded());
    render(<GroupSwipePage />);

    await screen.findByText("Card 12");
    press();
    await screen.findByText("Card 13", {}, slow);
    await screen.findByText("Your vote on Card 12 didn't save, so it's back in the deck.", {}, slow);
    press();
    await screen.findByText("Card 14", {}, slow);
    press();
    expect(await screen.findByText("Card 12", {}, slow)).toBeInTheDocument();

    answerPost = recorded;
    press();
    await screen.findByRole("heading", { name: "All films rated" }, slow);
    expect(postedIds()).toEqual([deck[12].id, deck[12].id, deck[13].id, deck[14].id, deck[12].id]);
    expect(screen.queryByText(/didn't save/)).toBeNull();
  });

  it("keeps a vote whose retry finds it already recorded", async () => {
    votedPositions = Array.from({ length: 14 }, (_, n) => n);
    let calls = 0;
    answerPost = async () =>
      ++calls === 1 ? failed() : Response.json({ error: "Already voted on this movie" }, { status: 409 });
    render(<GroupSwipePage />);

    await screen.findByText("Card 14");
    press();
    await waitFor(() => expect(postedIds()).toHaveLength(2), slow);
    // Past the retry's answer: nothing comes back.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.getByRole("heading", { name: "All films rated" })).toBeInTheDocument();
    expect(screen.queryByText(/didn't save/)).toBeNull();
  });

  it("drops the note once a poll brings the vote back from the server", async () => {
    // The last vote of the session: the server records it and finishes the session, but the answer is lost,
    // and the retry is refused because the session is no longer swiping.
    votedPositions = Array.from({ length: 14 }, (_, n) => n);
    let calls = 0;
    answerPost = async () => {
      if (++calls === 1) throw new TypeError("Failed to fetch");
      return Response.json({ error: "Session is not in swiping phase" }, { status: 400 });
    };
    render(<GroupSwipePage />);

    await screen.findByText("Card 14");
    press();
    await screen.findByText("Your vote on Card 14 didn't save, so it's back in the deck.", {}, slow);

    votedPositions = Array.from({ length: 15 }, (_, n) => n);
    answerGet = async () => {
      const state = await swipeState().json();
      return Response.json({ ...state, sessionStatus: "done" });
    };
    await act(async () => {
      await poll();
    });

    expect(await screen.findByRole("button", { name: /see group results/i })).toBeInTheDocument();
    expect(screen.queryByText(/didn't save/)).toBeNull();
  });

  it("numbers the card as the strip does after a gap", async () => {
    // 13 votes, none on 10 or 13: the strip counts votes, so this is film 14.
    votedPositions = [14, 12, 11, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0];
    render(<GroupSwipePage />);

    await screen.findByText("Card 10");
    expect(screen.getByText(/^Film/)).toHaveTextContent("Film 14 of 15");
    expect(screen.getByText(/^\d+ \/ 15$/)).toHaveTextContent("14 / 15");
  });

  const expired = async () => Response.json({ error: "Session expired" }, { status: 410 });
  const endHeading = (name: string) => screen.findByRole("heading", { level: 1, name }, slow);

  // Every vote would fail from here, and each one used to come back as "didn't save".
  it("ends when a poll finds the session expired mid-swipe, with focus on why", async () => {
    render(<GroupSwipePage />);
    await screen.findByText("Card 0");

    answerGet = expired;
    await act(async () => {
      await poll();
    });
    expect(await endHeading("This session has expired")).toHaveFocus();
    expect(screen.getByText("Group sessions last 4 hours.")).toBeInTheDocument();
    expect(screen.queryByText("Card 0")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to group" }));
    expect(router.push).toHaveBeenCalledWith("/group");
  });

  it("ends at the first vote that finds the session expired, without a retry or a note", async () => {
    answerPost = expired;
    render(<GroupSwipePage />);
    await screen.findByText("Card 0");
    press();

    await endHeading("This session has expired");
    await new Promise((r) => setTimeout(r, 900));
    expect(postedIds()).toEqual([deck[0].id]);
    expect(screen.queryByText(/didn't save/)).toBeNull();
  });

  it("ends at the first vote that finds the player removed, without a retry", async () => {
    answerPost = async () => Response.json({ error: "You are not in this session" }, { status: 403 });
    render(<GroupSwipePage />);
    await screen.findByText("Card 0");
    press();

    await endHeading("You're no longer in this session");
    await new Promise((r) => setTimeout(r, 900));
    expect(postedIds()).toEqual([deck[0].id]);
  });

  // A stranger, or another session's guest id: nothing says this player was ever in.
  it("keeps the error view for a 403 at the first load", async () => {
    answerGet = async () => Response.json({ error: "You are not in this session" }, { status: 403 });
    render(<GroupSwipePage />);
    expect(await screen.findByText("You are not in this session")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to lobby" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "You're no longer in this session" })).toBeNull();
  });

  // Without a token the stored id is this player's own signed-in seat, which a guest id can't act for: a 403
  // that would end the page for good. No id gets a 401, and the next poll with a token catches up.
  it("never sends a stored id for a signed-in player whose token didn't come back", async () => {
    storedId = "0b9d3c4e-2f1a-4c8b-9e7d-6a5b4c3d2e1f";
    withToken = false;
    render(<GroupSwipePage />);
    await screen.findByText("Card 0");
    press();
    await waitFor(() => expect(postedIds()).toHaveLength(1));

    const [getUrl] = fetchMock.mock.calls[0];
    expect(getUrl).toBe("/api/group/K7F2AB/swipe");
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body))).not.toHaveProperty("participantId");
  });

  it("ends on an expired session at the first load", async () => {
    answerGet = expired;
    render(<GroupSwipePage />);
    await endHeading("This session has expired");
    expect(screen.queryByRole("button", { name: "Back to lobby" })).toBeNull();
  });

  it("tells a player the host finished without them, once the deck had loaded", async () => {
    render(<GroupSwipePage />);
    await screen.findByText("Card 0");

    answerGet = async () => Response.json({ error: "You are not in this session" }, { status: 403 });
    await act(async () => {
      await poll();
    });
    expect(await endHeading("You're no longer in this session")).toHaveFocus();
    expect(screen.getByText("The host carried on without you.")).toBeInTheDocument();
  });

  it("lets the host finish without who's still swiping, after a confirm", async () => {
    votedPositions = Array.from({ length: 15 }, (_, n) => n);
    participants = players(true, false);
    render(<GroupSwipePage />);
    await screen.findByText("Waiting for others");

    fireEvent.click(screen.getByRole("button", { name: "Finish without Guest" }));
    expect(screen.getByRole("button", { name: "Keep waiting" })).toHaveAccessibleDescription(
      "Guest hasn't finished. Finishing now removes them and their votes so far.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Finish without Guest" }));

    // The focused confirm is gone with the waiting view.
    const results = await screen.findByRole("button", { name: /see group results/i }, slow);
    await waitFor(() => expect(results).toHaveFocus());
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patch[0]).toBe("/api/group/K7F2AB/swipe");
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ participantIds: ["p2"] });
  });

  // The last vote shows the waiting view before any read has the host finished.
  it("waits for a read showing the host finished before offering it", async () => {
    votedPositions = Array.from({ length: 14 }, (_, n) => n);
    participants = players(false, false);
    render(<GroupSwipePage />);
    await screen.findByText("Card 14");
    press();
    await screen.findByText("Waiting for others", {}, slow);
    expect(screen.queryByRole("button", { name: /without/ })).toBeNull();

    votedPositions = Array.from({ length: 15 }, (_, n) => n);
    participants = players(true, false);
    await act(async () => {
      await poll();
    });
    expect(screen.getByRole("button", { name: "Finish without Guest" })).toBeInTheDocument();
  });

  it("offers nobody but the host a way to finish without the others", async () => {
    votedPositions = Array.from({ length: 15 }, (_, n) => n);
    participants = [
      { id: "p1", user_id: "u9", nickname: "Host", has_swiped: false },
      { id: "p2", user_id: "u1", nickname: "Me", has_swiped: true },
    ];
    answerGet = async () => {
      const state = await swipeState().json();
      return Response.json({ ...state, hostId: "u9" });
    };
    render(<GroupSwipePage />);
    await screen.findByText("Waiting for others");
    expect(screen.queryByRole("button", { name: /without/ })).toBeNull();
  });
});
