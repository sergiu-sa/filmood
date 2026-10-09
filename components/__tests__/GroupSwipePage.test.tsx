/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import GroupSwipePage from "@/app/group/[code]/swipe/page";
import type { DeckFilm } from "@/lib/types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "K7F2AB" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "u1" }, loading: false }),
}));
vi.mock("@/lib/useParticipantId", () => ({ useParticipantId: () => ({ participantId: null, ready: true }) }));
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer t" }),
}));
vi.mock("@/lib/useGroupRealtime", () => ({ useGroupRealtime: () => {} }));
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
const swipeState = () =>
  Response.json({
    sessionId: "s1",
    deck,
    swipes: votedPositions.map((n) => ({ movie_id: deck[n].id, vote: "yes" })),
    progress: { swiped: votedPositions.length, total: deck.length },
    participants: [
      { id: "p1", user_id: "u1", nickname: "Host", has_swiped: false },
      { id: "p2", user_id: null, nickname: "Guest", has_swiped: true },
    ],
    sessionStatus: "swiping",
  });

const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
  init?.method === "POST"
    ? Response.json({ recorded: true, participantDone: false, allDone: false })
    : swipeState(),
);
vi.stubGlobal("fetch", fetchMock);

const postedIds = () =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "POST")
    .map(([, init]) => JSON.parse(String(init?.body)).movieId);
const press = () => fireEvent.keyDown(window, { key: "ArrowRight" });

describe("Group swipe page", () => {
  afterEach(() => {
    votedPositions = [];
    fetchMock.mockClear();
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
});
