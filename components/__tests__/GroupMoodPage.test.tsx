/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import GroupMoodPage from "@/app/group/[code]/mood/page";
import { allMoods } from "@/lib/moodMap";

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
vi.mock("@/lib/useParticipantId", () => ({ useParticipantId: () => ({ participantId: null }) }));
vi.mock("@/lib/useGroupRealtime", () => ({ useGroupRealtime: () => {} }));
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer t" }),
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

let selfSubmitted = false;
const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
  if (init?.method === "POST") return Response.json({ allDone: false });
  return Response.json({
    session: { id: "s1", status: "mood" },
    participants: [
      { id: "p1", nickname: "Host", user_id: "u1", has_submitted: selfSubmitted },
      { id: "p2", nickname: "Guest", user_id: null, has_submitted: false },
    ],
  });
});
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
    fetchMock.mockClear();
  });

  it("shows the session, its size and twelve unpressed toggle tiles", async () => {
    await renderPage();
    expect(screen.getByText(/Session/)).toHaveTextContent("Session K7F2AB · 2 people");
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
    expect(region).toHaveTextContent(HINT);

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
    expect(await screen.findByRole("heading", { level: 1, name: "Moods submitted" })).toBeInTheDocument();
  });

  it("sends the text, with Any as no Time or Era", async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText("Anything else? (optional)"), { target: { value: " cozy heist " } });
    fireEvent.click(lockIn());
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({ moods: [], time: null, era: null, text: "cozy heist" });
  });

  it("uses segments from 900px and vertical rows with hints below", async () => {
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
