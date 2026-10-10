/**
 * @vitest-environment jsdom
 */
import { act, render, screen } from "@testing-library/react";
import LobbyPage from "@/app/group/[code]/page";

const { router } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
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
// A guest: no account, a participant id from localStorage, no Realtime.
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/useParticipantId", () => ({ useParticipantId: () => ({ participantId: "p2", ready: true }) }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({ "Content-Type": "application/json" }) }));
// The page's refetch, as the 2 s poll would call it.
let poll: () => Promise<void> = async () => {};
vi.mock("@/lib/useGroupRealtime", () => ({
  useGroupRealtime: ({ onUpdate }: { onUpdate: () => Promise<void> }) => {
    poll = onUpdate;
  },
}));

const lobby = () =>
  Response.json({
    session: { id: "s1", code: "K7F2AB", host_id: "u1", status: "lobby", created_at: new Date().toISOString() },
    participants: [
      { id: "p1", nickname: "Host", user_id: "u1", is_ready: false, has_swiped: false, joined_at: "", has_submitted: false },
      { id: "p2", nickname: "Guest", user_id: null, is_ready: false, has_swiped: false, joined_at: "", has_submitted: false },
    ],
  });
const gone = () => Response.json({ error: "Session not found" }, { status: 404 });

let answer: () => Response = lobby;
vi.stubGlobal("fetch", vi.fn(async () => answer()));

beforeEach(() => {
  vi.clearAllMocks();
  answer = lobby;
});

describe("lobby page", () => {
  it("sends a guest back to /group when the session it was in disappears", async () => {
    render(<LobbyPage />);
    await screen.findByText("Guest");

    answer = gone;
    await act(() => poll());
    expect(router.replace).toHaveBeenCalledWith("/group");
    expect(screen.queryByText("Session not found")).toBeNull();
  });

  it("says the session wasn't found when it never loaded", async () => {
    answer = gone;
    render(<LobbyPage />);
    await screen.findByText("Session not found");
    expect(router.replace).not.toHaveBeenCalled();
  });
});
