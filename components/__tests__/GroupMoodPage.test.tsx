/**
 * @vitest-environment jsdom
 */
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GroupMoodPage from "@/app/group/[code]/mood/page";
import { allMoods } from "@/lib/moodMap";

// One router and one user for every render: a new one each time changes fetchState and refetches in a loop.
const { router, host } = vi.hoisted(() => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn() },
  host: { id: "u1" },
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

// Signed in as the host (u1), or a guest holding p2's participant id.
let signedIn = true;
vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ user: signedIn ? host : null, loading: false }),
}));
vi.mock("@/lib/useParticipantId", () => ({ useParticipantId: () => ({ participantId: signedIn ? null : "p2" }) }));
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () =>
    signedIn ? { "Content-Type": "application/json", Authorization: "Bearer t" } : { "Content-Type": "application/json" },
}));

// The page's refetch, as Realtime or the 2s poll would call it.
let poll: () => Promise<void> = async () => {};
vi.mock("@/lib/useGroupRealtime", () => ({
  useGroupRealtime: ({ onUpdate }: { onUpdate: () => Promise<void> }) => {
    poll = onUpdate;
  },
}));

// The viewport width the mocked media queries answer for.
let width = 1280;
vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (query: string) => {
    const max = Number(/max-width: (\d+)px/.exec(query)?.[1]);
    return Number.isFinite(max) && width <= max;
  },
}));

const HINT = "Two is the max — tap one of yours to swap it out.";

const session = (selfSubmitted: boolean, extra: object[] = []) =>
  Response.json({
    session: { id: "s1", status: "mood", host_id: "u1" },
    participants: [
      { id: "p1", nickname: "Host", user_id: "u1", has_submitted: selfSubmitted },
      { id: "p2", nickname: "Guest", user_id: null, has_submitted: false },
      ...extra,
    ],
  });

function deferred() {
  let resolve!: (r: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return { promise, resolve };
}

let selfSubmitted = false;
let answerPost: () => Promise<Response> = async () => Response.json({ allDone: false });
let answerGet: () => Promise<Response> = async () => session(selfSubmitted);
let answerPatch: () => Promise<Response> = async () => Response.json({ removed: 1 });
const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
  init?.method === "POST" ? answerPost() : init?.method === "PATCH" ? answerPatch() : answerGet(),
);
vi.stubGlobal("fetch", fetchMock);

const tile = (tagLabel: string) => screen.getByRole("button", { name: new RegExp(`^${tagLabel} — `) });
const lockIn = () => screen.getByRole("button", { name: /^Lock in|^Pick a mood/ });
const posts = () => fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");

async function renderPage() {
  render(<GroupMoodPage />);
  await screen.findByRole("heading", { level: 1, name: "How do you feel?" });
}

describe("Group mood page", () => {
  afterEach(() => {
    width = 1280;
    selfSubmitted = false;
    signedIn = true;
    answerPost = async () => Response.json({ allDone: false });
    answerGet = async () => session(selfSubmitted);
    answerPatch = async () => Response.json({ removed: 1 });
    vi.clearAllMocks();
  });

  it("shows the session, its size and twelve unpressed toggle tiles", async () => {
    await renderPage();
    expect(screen.getByText(/Session/)).toHaveTextContent("Session K7F2AB · 2 people");
    expect(screen.getByText("No one sees who picked what.")).toBeInTheDocument();
    allMoods.forEach((m) => expect(tile(m.tagLabel)).toHaveAttribute("aria-pressed", "false"));
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(allMoods.length);
  });

  it("presses two, refuses a third with a polite hint, and clears it on an untap", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(tile("Go dark"));
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    expect(screen.queryByText(HINT)).toBeNull();

    // Mounted before the hint arrives, or a screen reader may not hear it.
    const region = document.querySelector('p[aria-live="polite"]:not([role])');
    expect(region).toBeEmptyDOMElement();

    fireEvent.click(tile("Need a hug"));
    expect(tile("Need a hug")).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    await waitFor(() => expect(region).toHaveTextContent(HINT));

    // The same text set again changes nothing a polite region would announce,
    // so a second refusal empties it first.
    fireEvent.click(tile("Date night"));
    expect(region).toBeEmptyDOMElement();
    await waitFor(() => expect(region).toHaveTextContent(HINT));

    fireEvent.click(tile("Go dark"));
    expect(screen.queryByText(HINT)).toBeNull();
    fireEvent.click(tile("Need a hug"));
    expect(tile("Need a hug")).toHaveAttribute("aria-pressed", "true");
  });

  it("counts picks and names the lock-in by them; with none it's blocked", async () => {
    await renderPage();
    expect(screen.getByText("0 of 2")).toBeInTheDocument();
    expect(lockIn()).toHaveTextContent("Pick a mood to lock in");
    expect(lockIn()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(lockIn());
    expect(posts()).toHaveLength(0);

    fireEvent.click(tile("Need to laugh"));
    expect(lockIn()).toHaveTextContent("Lock in 1 mood");
    fireEvent.click(tile("Go dark"));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(lockIn()).toHaveTextContent("Lock in 2 moods");
    expect(lockIn()).toHaveAttribute("aria-disabled", "false");
  });

  it("locks in text alone only when it reads as a mood", async () => {
    await renderPage();
    const field = screen.getByLabelText("Anything else? (optional)");
    fireEvent.change(field, { target: { value: "80s" } });
    expect(lockIn()).toHaveTextContent("Pick a mood to lock in");
    expect(lockIn()).toHaveAttribute("aria-disabled", "true");
    fireEvent.change(field, { target: { value: "cozy" } });
    expect(lockIn()).toHaveTextContent("Lock in 1 mood");
    expect(lockIn()).toHaveAttribute("aria-disabled", "false");
  });

  it("counts the text's mood after the tiles, two in all", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), { target: { value: "cozy scary" } });
    expect(lockIn()).toHaveTextContent("Lock in 2 moods");
  });

  it("posts two moods, a Time and an Era, and no tempo, then waits", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(tile("Go dark"));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Time" })).getByRole("radio", { name: "Under 2 h" }));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Era" })).getByRole("radio", { name: "Before 1990" }));
    fireEvent.click(lockIn());

    await waitFor(() => expect(posts()).toHaveLength(1));
    const [url, init] = posts()[0];
    expect(url).toBe("/api/group/K7F2AB/mood");
    expect(JSON.parse(init!.body as string)).toEqual({ moods: ["laugh", "dark"], time: "medium", era: "classic" });
    // The lock-in button is gone, so focus moves to the heading that says why.
    expect(await screen.findByRole("heading", { level: 1, name: "Moods submitted" })).toHaveFocus();
  });

  it("ignores taps and a second lock-in while the first is pending", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    const post = deferred();
    answerPost = () => post.promise;
    fireEvent.click(lockIn());
    await waitFor(() => expect(posts()).toHaveLength(1));

    fireEvent.click(tile("Go dark"));
    expect(tile("Go dark")).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: "Submitting..." }));
    post.resolve(Response.json({ allDone: false }));
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1]!.body as string).moods).toEqual(["laugh"]);
  });

  // The 422 is a deck too thin for the group's picks: the last submitter changes them and locks in again.
  it.each([
    [500, "Failed to build the deck"],
    [422, "Nothing fits everyone's picks together. Try a different mood."],
  ])("returns to the form after a failed lock-in (%i), with the error and the picks kept", async (status, error) => {
    answerPost = async () => Response.json({ error }, { status });
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(tile("Go dark"));
    const before1990 = within(screen.getByRole("radiogroup", { name: "Era" })).getByRole("radio", { name: "Before 1990" });
    fireEvent.click(before1990);
    fireEvent.click(lockIn());

    expect(await screen.findByRole("alert")).toHaveTextContent(error);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you feel?");
    expect(screen.getAllByRole("button", { pressed: true })).toHaveLength(2);
    expect(before1990).toBeChecked();
    expect(lockIn()).toHaveTextContent("Lock in 2 moods");
    expect(lockIn()).toHaveAttribute("aria-disabled", "false");
  });

  // A read taken while the last lock-in builds the deck sees it submitted; the build then fails and rolls it back.
  it("doesn't let a status read from before a failed lock-in move the page to waiting", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    const post = deferred();
    answerPost = () => post.promise;
    fireEvent.click(lockIn());
    await waitFor(() => expect(posts()).toHaveLength(1));

    const read = deferred();
    answerGet = () => read.promise;
    const polled = poll();
    post.resolve(Response.json({ error: "Failed to build the deck" }, { status: 500 }));
    await screen.findByRole("alert");

    read.resolve(session(true, [{ id: "p3", nickname: "Third", user_id: null, has_submitted: false }]));
    await polled;
    // The stale read did land (three people now), but the page stays on the form.
    await screen.findByText(/3 people/);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you feel?");
    expect(lockIn()).toHaveTextContent("Lock in 1 mood");
  });

  it("puts no alert above Lock in for a failed poll once the page has loaded", async () => {
    await renderPage();
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    await act(() => poll());
    answerGet = async () => {
      throw new TypeError("Failed to fetch");
    };
    await act(() => poll());
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you feel?");
  });

  it("clears a failed first load's error once a poll gets through, and moves focus to the heading", async () => {
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    render(<GroupMoodPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load session");
    screen.getByRole("button", { name: "Back to lobby" }).focus();

    answerGet = async () => session(selfSubmitted);
    await act(() => poll());
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("How do you feel?");
    expect(heading).toHaveFocus();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("leaves focus where the person put it when a poll recovers from a failed first load", async () => {
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    render(<GroupMoodPage />);
    await screen.findByRole("alert");
    // Stands in for the layout's header, which stays mounted.
    const nav = document.body.appendChild(document.createElement("button"));
    try {
      nav.focus();
      answerGet = async () => session(selfSubmitted);
      await act(() => poll());
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you feel?");
      expect(nav).toHaveFocus();
    } finally {
      nav.remove();
    }
  });

  it("keeps the error view when a poll after a failed first load answers 200 without a session", async () => {
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    render(<GroupMoodPage />);
    await screen.findByRole("alert");

    answerGet = async () => Response.json({});
    await act(() => poll());
    // The read throws before the page counts as loaded, so the catch still sets its message.
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    expect(screen.getByRole("button", { name: "Back to lobby" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("ignores polls once Back to lobby is clicked, since the page is leaving", async () => {
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    render(<GroupMoodPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Back to lobby" }));
    expect(router.push).toHaveBeenCalledWith("/group/K7F2AB");

    answerGet = async () => session(selfSubmitted);
    await act(() => poll());
    expect(screen.getByRole("button", { name: "Back to lobby" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("doesn't move focus to the heading when the recovering poll sends the page elsewhere", async () => {
    answerGet = async () => Response.json({ error: "Failed to load session" }, { status: 500 });
    render(<GroupMoodPage />);
    await screen.findByRole("alert");

    answerGet = async () => Response.json({ session: { id: "s1", status: "done" }, participants: [] });
    await act(() => poll());
    expect(router.replace).toHaveBeenCalledWith("/group/K7F2AB/results");
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveFocus();
  });

  const expired = async () => Response.json({ error: "Session expired" }, { status: 410 });
  const endHeading = (name: string) => screen.findByRole("heading", { level: 1, name });

  // The tiles, or the waiting list, would only lead to failures from here.
  it.each([
    ["while picking", false],
    ["while waiting", true],
  ])("ends on an expired session %s, with focus on why", async (_, submitted) => {
    selfSubmitted = submitted;
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: submitted ? "Moods submitted" : "How do you feel?" });

    answerGet = expired;
    await act(() => poll());
    expect(await endHeading("This session has expired")).toHaveFocus();
    expect(screen.getByText("Group sessions last 4 hours.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Lock in|^Pick a mood/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Back to group" }));
    expect(router.push).toHaveBeenCalledWith("/group");
  });

  it("ends on an expired session at the first load", async () => {
    answerGet = expired;
    render(<GroupMoodPage />);
    await endHeading("This session has expired");
    expect(screen.queryByRole("button", { name: "Back to lobby" })).toBeNull();
  });

  it("ends when the lock-in finds the session expired", async () => {
    await renderPage();
    answerPost = expired;
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(lockIn());
    await endHeading("This session has expired");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  // The host's PATCH removes the seat and moves the session on, so one poll usually sees both.
  it("tells a player the host carried on without them, rather than follow the session to swiping", async () => {
    await renderPage();
    answerGet = async () =>
      Response.json({
        session: { id: "s1", status: "swiping", host_id: "u9" },
        participants: [{ id: "p9", nickname: "Host", user_id: "u9", has_submitted: true }],
      });
    await act(() => poll());

    expect(await endHeading("You're no longer in this session")).toHaveFocus();
    expect(screen.getByText("The host carried on without you.")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("lets the host start without who's still choosing, after a confirm naming them", async () => {
    selfSubmitted = true;
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });

    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    const keep = screen.getByRole("button", { name: "Keep waiting" });
    expect(keep).toHaveFocus();
    expect(keep).toHaveAccessibleDescription("Guest hasn't locked in. Starting now removes them from the session.");
    fireEvent.click(keep);
    expect(screen.getByRole("button", { name: "Start without Guest" })).toHaveFocus();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    answerGet = async () =>
      Response.json({
        session: { id: "s1", status: "swiping", host_id: "u1" },
        participants: [{ id: "p1", nickname: "Host", user_id: "u1", has_submitted: true }],
      });
    fireEvent.click(screen.getAllByRole("button", { name: "Start without Guest" }).at(-1)!);

    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/group/K7F2AB/swipe"), { timeout: 3000 });
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(patch[0]).toBe("/api/group/K7F2AB/mood");
    expect(new Headers(patch[1]!.headers).get("Authorization")).toBe("Bearer t");
    // Who the confirm named: the server refuses to remove anyone else.
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ participantIds: ["p2"] });
  });

  // The lock-in's answer shows the waiting view before any read has the host locked in.
  it("waits for a read showing the host locked in before offering it", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(lockIn());
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });
    expect(screen.queryByRole("button", { name: /without/ })).toBeNull();

    selfSubmitted = true;
    await act(() => poll());
    expect(screen.getByRole("button", { name: "Start without Guest" })).toBeInTheDocument();
  });

  it("names how many are left out when it's more than one, and shows a refusal with the list back", async () => {
    selfSubmitted = true;
    answerGet = async () => session(true, [{ id: "p3", nickname: "Third", user_id: null, has_submitted: false }]);
    answerPatch = async () =>
      Response.json({ error: "Someone else is still choosing. Check the list and try again." }, { status: 409 });
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });

    fireEvent.click(screen.getByRole("button", { name: "Start without the 2 still choosing" }));
    expect(screen.getByRole("button", { name: "Keep waiting" })).toHaveAccessibleDescription(
      "Guest and Third haven't locked in. Starting now removes them from the session.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Start without the 2 still choosing" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Someone else is still choosing.");
    expect(screen.queryByRole("button", { name: "Keep waiting" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start without the 2 still choosing" })).toHaveFocus();
  });

  // The others are all locked in, so only the host's picks can change; the route has cleared them.
  it("gives the host the picker back when the deck would be too thin", async () => {
    selfSubmitted = true;
    answerPatch = async () => {
      selfSubmitted = false;
      return Response.json({ error: "Nothing fits everyone's picks together. Try a different mood." }, { status: 422 });
    };
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });

    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));

    const heading = await screen.findByRole("heading", { level: 1, name: "How do you feel?" });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(screen.getByRole("alert")).toHaveTextContent("Nothing fits everyone's picks together. Try a different mood.");
    expect(lockIn()).toBeInTheDocument();
  });

  it("doesn't let a read from before the picks were handed back bring waiting back", async () => {
    selfSubmitted = true;
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));

    const read = deferred();
    answerGet = () => read.promise;
    const polled = poll();
    answerPatch = async () =>
      Response.json({ error: "Nothing fits everyone's picks together. Try a different mood." }, { status: 422 });
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    await screen.findByRole("heading", { level: 1, name: "How do you feel?" });

    read.resolve(session(true));
    await act(() => polled);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("How do you feel?");
  });

  // A poll can change who's waiting while the confirm is open; it keeps the names it showed.
  it("keeps the confirm's names when the list changes under it, and sends those", async () => {
    selfSubmitted = true;
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));

    answerGet = async () =>
      Response.json({
        session: { id: "s1", status: "mood", host_id: "u1" },
        participants: [
          { id: "p1", nickname: "Host", user_id: "u1", has_submitted: true },
          { id: "p2", nickname: "Guest", user_id: null, has_submitted: true },
        ],
      });
    await act(() => poll());
    expect(screen.getByRole("button", { name: "Keep waiting" })).toHaveAccessibleDescription(
      "Guest hasn't locked in. Starting now removes them from the session.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH")!;
    expect(JSON.parse(String(patch[1]!.body))).toEqual({ participantIds: ["p2"] });
  });

  it("sends one request when the confirm is pressed again while the first is pending", async () => {
    selfSubmitted = true;
    const pending = deferred();
    answerPatch = () => pending.promise;
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });

    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Start without Guest" }));
    await act(async () => {});
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(1);
    pending.resolve(Response.json({ removed: 1 }));
  });

  // A seat deleted with its account leaves everyone else in, and no lock-in is coming to build the deck.
  it("offers the host Start swiping, with no confirm, when nobody is left choosing", async () => {
    selfSubmitted = true;
    answerGet = async () =>
      Response.json({
        session: { id: "s1", status: "mood", host_id: "u1" },
        participants: [{ id: "p1", nickname: "Host", user_id: "u1", has_submitted: true }],
      });
    render(<GroupMoodPage />);
    await screen.findByText("Everyone is in");

    fireEvent.click(screen.getByRole("button", { name: "Start swiping" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
    expect(screen.queryByRole("button", { name: "Keep waiting" })).toBeNull();
  });

  it("offers nobody else a way to start without the others", async () => {
    signedIn = false;
    answerGet = async () =>
      Response.json({
        session: { id: "s1", status: "mood", host_id: "u1" },
        participants: [
          { id: "p1", nickname: "Host", user_id: "u1", has_submitted: false },
          { id: "p2", nickname: "Guest", user_id: null, has_submitted: true },
        ],
      });
    render(<GroupMoodPage />);
    await screen.findByRole("heading", { level: 1, name: "Moods submitted" });
    expect(screen.queryByRole("button", { name: /without|Start swiping/ })).toBeNull();
  });

  it("hands the echo the picked tiles and the page's Era", async () => {
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(tile("Go dark"));
    fireEvent.click(within(screen.getByRole("radiogroup", { name: "Era" })).getByRole("radio", { name: "2010 on" }));
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), { target: { value: "cozy 80s" } });
    const echo = screen.getByRole("status");
    await waitFor(() => expect(echo).toHaveTextContent("Two moods at a time — left out Need a hug."));
    expect(echo).not.toHaveTextContent("Before 1990");
  });

  it("sends a guest's participant id", async () => {
    signedIn = false;
    await renderPage();
    fireEvent.click(tile("Need to laugh"));
    fireEvent.click(lockIn());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ moods: ["laugh"], time: null, era: null, participantId: "p2" });
  });

  it("sends the text, with Any as no Time or Era", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), { target: { value: " cozy heist " } });
    fireEvent.click(lockIn());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ moods: [], time: null, era: null, text: "cozy heist" });
  });

  it("uses short-label segments from 900px", async () => {
    await renderPage();
    expect(screen.getByRole("radiogroup", { name: "Time" })).toHaveAttribute("aria-orientation", "horizontal");
    expect(screen.getByRole("radio", { name: "Under 2 h" })).toBeInTheDocument();
  });

  it("stacks the groups vertically below 900px", async () => {
    width = 390;
    await renderPage();
    expect(screen.getByRole("radiogroup", { name: "Time" })).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("radiogroup", { name: "Era" })).toHaveAttribute("aria-orientation", "vertical");
    expect(screen.getByRole("radio", { name: /Under 2 hours/ })).toBeInTheDocument();
  });

  it("goes straight to the waiting view when this participant already submitted", async () => {
    selfSubmitted = true;
    render(<GroupMoodPage />);
    expect(await screen.findByRole("heading", { level: 1, name: "Moods submitted" })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("button", { name: /^Lock in|^Pick a mood/ })).not.toBeInTheDocument());
  });
});
