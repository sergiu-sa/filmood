/**
 * @vitest-environment jsdom
 */
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardShell from "@/components/dashboard/DashboardShell";
import type SearchToolbar from "@/components/dashboard/SearchToolbar";

type ToolbarProps = Parameters<typeof SearchToolbar>[0];
const toolbar = vi.hoisted(() => ({ props: null as unknown as ToolbarProps }));
const media = vi.hoisted(() => ({ mobile: false }));

vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => media.mobile }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));
// The real toolbar is tested on its own; here it only hands the shell its props.
vi.mock("@/components/dashboard/SearchToolbar", () => ({
  default: (props: ToolbarProps) => {
    toolbar.props = props;
    return null;
  },
}));
vi.mock("@/components/dashboard/MoodPanel", () => ({ default: () => null }));

/** A panel's Close, found by what sits beside it in that panel's footer. */
const closeBeside = async (text: string) =>
  within((await screen.findByText(text)).parentElement!).getByRole("button", { name: "Close" });
const film = (id: number, title: string) => ({ id, title, poster_path: null, release_date: "2020-01-01", vote_average: 7, overview: "" });
const answer = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
const held = () => {
  let settle: (r: Response) => void = () => {};
  return { promise: new Promise<Response>((r) => (settle = r)), settle: (body: unknown) => settle(Response.json(body)) };
};
const card = (name: string) => screen.queryByRole("heading", { level: 3, name });
const fullSearch = () => screen.getByRole("link", { name: /Full search/ });

const fetchMock = vi.fn();
let onSearch: (q: string) => Promise<Response>;
let onBrowse: (category: string) => Promise<Response>;
const calls = (path: string) => fetchMock.mock.calls.filter(([url]) => String(url).startsWith(path)).length;

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    if (u.pathname === "/api/movies/search") return onSearch(u.searchParams.get("query")!);
    if (u.pathname === "/api/movies/browse") return onBrowse(u.searchParams.get("category")!);
    return answer({ films: [] });
  });
  vi.stubGlobal("fetch", fetchMock);
  onSearch = () => answer({ films: [film(1, "Dune")] });
  onBrowse = (category) => answer({ films: category === "top-rated" ? [film(2, "The Godfather")] : [] });
});
afterEach(() => vi.unstubAllGlobals());

const openPanel = () => act(() => toolbar.props.onExpand());
/** Types in the toolbar's box and presses Enter, which searches without the debounce. */
const searchFor = (text: string) => {
  act(() => toolbar.props.onQueryChange(text));
  act(() => toolbar.props.onSubmit());
};

describe("DashboardShell, desktop", () => {
  beforeEach(() => {
    media.mobile = false;
  });

  // Closed, a panel is inert, so focus on its Close would fall to <body>.
  it("hands focus back to the box after a panel's Close", async () => {
    const user = userEvent.setup();
    render(<DashboardShell />);

    const explore = screen.getByRole("button", { name: /^Discover together/ });
    await user.click(explore);
    await user.click(await closeBeside("Sessions expire after 4 hours"));
    expect(explore).toHaveAttribute("aria-expanded", "false");
    expect(explore).toHaveFocus();

    const trending = screen.getByRole("button", { name: "Trending today" });
    await user.click(trending);
    await user.click(await closeBeside("No results"));
    expect(trending).toHaveAttribute("aria-expanded", "false");
    expect(trending).toHaveFocus();
  });

  it("Full search carries the search; picking a category replaces it", async () => {
    render(<DashboardShell />);
    openPanel();
    searchFor("dune");
    await screen.findByRole("heading", { level: 3, name: "Dune" });
    expect(fullSearch()).toHaveAttribute("href", "/browse?q=dune");
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1 film matching "dune"');

    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));
    await screen.findByRole("heading", { level: 3, name: "The Godfather" });
    expect(fullSearch()).toHaveAttribute("href", "/browse?category=top-rated");
    // The toolbar's box empties with it.
    expect(toolbar.props.query).toBe("");
  });

  it("a search over a category is the search alone; clearing it brings the category back at once", async () => {
    render(<DashboardShell />);
    openPanel();
    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));
    await screen.findByRole("heading", { level: 3, name: "The Godfather" });

    searchFor("dune");
    await screen.findByRole("heading", { level: 3, name: "Dune" });
    // Once the debounce holds "dune" too, only the empty box can bring the category back at once.
    await act(() => new Promise((r) => setTimeout(r, 450)));
    expect(screen.getByRole("heading", { level: 3, name: "Browse & Search" })).toBeInTheDocument();
    expect(fullSearch()).toHaveAttribute("href", "/browse?q=dune");
    expect(toolbar.props.activeCategory).toBeNull();

    act(() => toolbar.props.onQueryChange(""));
    expect(card("The Godfather")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Trending today" })).toHaveAttribute("aria-expanded", "true");
    expect(calls("/api/movies/browse?category=top-rated")).toBe(1);
  });

  it("says a search found nothing instead of showing the list under it", async () => {
    onBrowse = () => answer({ films: [film(9, "Trending film")] });
    onSearch = () => answer({ films: [] });
    render(<DashboardShell />);
    openPanel();
    await screen.findByRole("heading", { level: 3, name: "Trending film" });

    searchFor("xyzxyz");
    expect(await screen.findByText('No films matching "xyzxyz"')).toBeInTheDocument();
    expect(card("Trending film")).not.toBeInTheDocument();
  });

  it("shows a failed search as an error; Try again runs it again", async () => {
    onSearch = () => answer({ error: "Failed to search films" }, 500);
    render(<DashboardShell />);
    openPanel();
    searchFor("dune");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");

    onSearch = () => answer({ films: [film(1, "Dune")] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Dune" })).toBeInTheDocument();
    expect(calls("/api/movies/search")).toBe(2);
  });

  it("shows a failed category as an error; Try again fetches it again", async () => {
    render(<DashboardShell />);
    openPanel();
    onBrowse = () => answer({ error: "Failed to browse films" }, 500);
    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");

    onBrowse = () => answer({ films: [film(2, "The Godfather")] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 3, name: "The Godfather" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an outage when the panel first opens as an error", async () => {
    onBrowse = () => answer({ error: "Failed to browse films" }, 500);
    render(<DashboardShell />);
    openPanel();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");
  });

  it("never reopens a panel that was closed while its search was answering", async () => {
    const search = held();
    onSearch = () => search.promise;
    render(<DashboardShell />);
    openPanel();
    searchFor("dune");
    await waitFor(() => expect(calls("/api/movies/search")).toBe(1));

    await userEvent.click(await closeBeside("Loading..."));
    await act(async () => search.settle({ films: [film(1, "Dune")] }));
    expect(screen.getByRole("button", { name: "Trending today" })).toHaveAttribute("aria-expanded", "false");
  });

  it("never lets a late category answer replace a newer search", async () => {
    const topRated = held();
    onBrowse = (category) => (category === "top-rated" ? topRated.promise : answer({ films: [] }));
    render(<DashboardShell />);
    openPanel();
    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));

    searchFor("dune");
    await screen.findByRole("heading", { level: 3, name: "Dune" });
    await act(async () => topRated.settle({ films: [film(2, "The Godfather")] }));
    expect(card("Dune")).toBeInTheDocument();
    expect(card("The Godfather")).not.toBeInTheDocument();
  });

  it("tells the toolbar a search is in flight", async () => {
    const search = held();
    onSearch = () => search.promise;
    render(<DashboardShell />);
    openPanel();
    searchFor("dune");
    expect(toolbar.props.loading).toBe(true);

    await act(async () => search.settle({ films: [film(1, "Dune")] }));
    expect(toolbar.props.loading).toBe(false);
  });
});

describe("DashboardShell, phone", () => {
  beforeEach(() => {
    media.mobile = true;
  });

  // The sheet hands focus back to the toolbar's box when it closes; opening on focus reopened it.
  it("tells the toolbar not to open the sheet on focus", () => {
    render(<DashboardShell />);
    expect(toolbar.props.expandOnFocus).toBe(false);
  });

  it("the sheet's box edits the toolbar's search", async () => {
    render(<DashboardShell />);
    openPanel();
    const input = await screen.findByRole("textbox", { name: "Search films" });
    // The sheet takes focus a frame after it opens; a person taps the box after that.
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    await userEvent.type(input, "dune");
    expect(toolbar.props.query).toBe("dune");
  });

  // An answer opening the sheet took focus from someone still typing in the toolbar.
  it("typing in the toolbar leaves the sheet closed until Enter", async () => {
    render(<DashboardShell />);
    act(() => toolbar.props.onQueryChange("dune"));
    await waitFor(() => expect(calls("/api/movies/search")).toBe(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByRole("dialog")).toHaveAttribute("inert");

    act(() => toolbar.props.onSubmit());
    expect(screen.getByRole("dialog")).not.toHaveAttribute("inert");
  });
});
