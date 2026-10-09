/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import WatchlistPage from "@/app/watchlist/page";

const auth = vi.hoisted(() => ({ value: { user: null as { id: string } | null, loading: false } }));

vi.mock("@/components/AuthProvider", () => ({ useAuth: () => auth.value }));
vi.mock("@/lib/getAuthToken", () => ({
  getAuthHeaders: async () => ({ "Content-Type": "application/json", Authorization: "Bearer t" }),
}));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));

// Newest first, as the route answers.
const rows = [
  { movie_id: 1, movie_title: "Arrival", poster_path: "/a.jpg", release_date: "2016-11-10", vote_average: 7.6 },
  { movie_id: 2, movie_title: "Blade Runner", poster_path: null, release_date: "1982-06-25", vote_average: 7.9 },
  { movie_id: 3, movie_title: "Contact", poster_path: "/c.jpg", release_date: null, vote_average: null },
];

const fetchMock = vi.fn();
const answer = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => body });
const cardTitles = () => screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  auth.value = { user: { id: "user-1" }, loading: false };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("/watchlist", () => {
  it("asks a guest to log in and fetches nothing", async () => {
    auth.value = { user: null, loading: false };
    render(<WatchlistPage />);
    expect(screen.getByText("Log in to see your watchlist.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Sign up" })).toHaveAttribute("href", "/signup");
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the empty state with a way to find films", async () => {
    fetchMock.mockReturnValueOnce(answer({ watchlist: [] }));
    render(<WatchlistPage />);
    expect(await screen.findByText("Nothing saved yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pick a mood" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Browse films" })).toHaveAttribute("href", "/browse");
  });

  it("lists the films in the route's order with their ratings and years", async () => {
    fetchMock.mockReturnValueOnce(answer({ watchlist: rows }));
    render(<WatchlistPage />);
    await screen.findByText("Arrival");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/watchlist?details=1",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer t" }) }),
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My watchlist · 3 films");
    expect(cardTitles()).toEqual(["Arrival", "Blade Runner", "Contact"]);
    const cards = screen.getAllByRole("listitem");
    expect(cards[0]).toHaveTextContent("★ 7.6");
    expect(cards[0]).toHaveTextContent("2016");
    expect(cards[1]).toHaveTextContent("★ 7.9");
    // A failed lookup: no rating, no year, no "N/A".
    expect(cards[2]).not.toHaveTextContent("★");
    expect(cards[2]).not.toHaveTextContent("N/A");
  });

  it("drops a removed card at once and deletes it", async () => {
    fetchMock.mockReturnValueOnce(answer({ watchlist: rows })).mockReturnValueOnce(answer({ success: true }));
    render(<WatchlistPage />);
    const remove = await screen.findByRole("button", { name: "Remove Blade Runner" });
    const heading = screen.getByRole("heading", { level: 1 });
    // What a screen reader reads as focus lands: the count must already be the new one.
    let readOnFocus = "";
    heading.addEventListener("focus", () => (readOnFocus = heading.textContent ?? ""));
    await userEvent.click(remove);
    expect(cardTitles()).toEqual(["Arrival", "Contact"]);
    expect(heading).toHaveFocus();
    expect(readOnFocus).toBe("My watchlist · 2 films");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/watchlist/remove",
      expect.objectContaining({
        method: "DELETE",
        headers: expect.objectContaining({ Authorization: "Bearer t" }),
        body: JSON.stringify({ movie_id: 2 }),
      }),
    );
  });

  it("keeps a new account's list when the old account's answer lands late", async () => {
    let answerOld: (v: unknown) => void = () => {};
    fetchMock
      .mockReturnValueOnce(new Promise((resolve) => (answerOld = resolve)))
      .mockReturnValueOnce(answer({ watchlist: [rows[2]] }));
    const { rerender } = render(<WatchlistPage />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    auth.value = { user: { id: "user-2" }, loading: false };
    rerender(<WatchlistPage />);
    await screen.findByText("Contact");
    answerOld(await answer({ watchlist: rows.slice(0, 2) }));
    await new Promise((r) => setTimeout(r, 0));
    expect(cardTitles()).toEqual(["Contact"]);
  });

  // A refresh hands out a new user object with the same id; refetching would wipe a remove in flight.
  it("doesn't refetch on a token refresh", async () => {
    fetchMock.mockReturnValueOnce(answer({ watchlist: rows }));
    const { rerender } = render(<WatchlistPage />);
    await screen.findByText("Arrival");
    auth.value = { user: { id: "user-1" }, loading: false };
    rerender(<WatchlistPage />);
    await new Promise((r) => setTimeout(r, 0));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("puts a card back in its place when the delete fails, and says so", async () => {
    fetchMock.mockReturnValueOnce(answer({ watchlist: rows })).mockReturnValueOnce(answer({}, false));
    render(<WatchlistPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Remove Blade Runner" }));
    await waitFor(() => expect(cardTitles()).toEqual(["Arrival", "Blade Runner", "Contact"]));
    const region = document.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(within(region).getByText("Couldn't remove Blade Runner.")).toBeInTheDocument();
  });
});
