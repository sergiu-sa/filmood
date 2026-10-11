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
const closeBeside = (text: string) => within(screen.getByText(text).parentElement!).getByRole("button", { name: "Close" });
const film = (id: number, title: string) => ({ id, title, poster_path: null, release_date: "2020-01-01", vote_average: 7, overview: "" });
const fullSearch = () => screen.getByRole("link", { name: /Full search/ });
const answer = (body: unknown, status = 200) => Response.json(body, { status });

describe("DashboardShell, desktop", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    media.mobile = false;
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => answer({ films: [] }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  // Closed, a panel is inert, so focus on its Close would fall to <body>.
  it("hands focus back to the box after a panel's Close", async () => {
    const user = userEvent.setup();
    render(<DashboardShell />);

    const explore = screen.getByRole("button", { name: /^Discover together/ });
    await user.click(explore);
    await user.click(closeBeside("Sessions expire after 4 hours"));
    expect(explore).toHaveAttribute("aria-expanded", "false");
    expect(explore).toHaveFocus();

    const trending = screen.getByRole("button", { name: "Trending today" });
    await user.click(trending);
    await user.click(closeBeside("No results"));
    expect(trending).toHaveAttribute("aria-expanded", "false");
    expect(trending).toHaveFocus();
  });

  it("Full search carries the toolbar's search; picking a category drops it", async () => {
    render(<DashboardShell />);
    act(() => toolbar.props.onQueryChange("dune"));
    act(() => toolbar.props.onResults([film(1, "Dune")], "dune"));
    act(() => toolbar.props.onExpand());

    expect(fullSearch()).toHaveAttribute("href", "/browse?q=dune");
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 1 film matching "dune"');

    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));
    expect(fullSearch()).toHaveAttribute("href", "/browse?category=top-rated");
    // The toolbar's box empties with it.
    expect(toolbar.props.query).toBe("");
  });

  it("says a search found nothing instead of showing the preloaded list", async () => {
    fetchMock.mockImplementation(async () => answer({ films: [film(9, "Trending film")] }));
    render(<DashboardShell />);
    act(() => toolbar.props.onExpand());
    const card = { level: 3, name: "Trending film" };
    await screen.findByRole("heading", card);

    act(() => toolbar.props.onResults([], "xyzxyz"));
    expect(screen.getByText('No films matching "xyzxyz"')).toBeInTheDocument();
    expect(screen.queryByRole("heading", card)).not.toBeInTheDocument();
  });

  it("shows a failed search as an error; Try again runs it again", async () => {
    render(<DashboardShell />);
    const retry = vi.fn();
    act(() => toolbar.props.onFailed("dune", retry));
    act(() => toolbar.props.onExpand());

    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the film database.");
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("shows a failed category as an error; Try again fetches it again", async () => {
    render(<DashboardShell />);
    act(() => toolbar.props.onExpand());
    fetchMock.mockImplementation(async () => answer({ error: "Failed to browse films" }, 500));
    await userEvent.click(screen.getByRole("button", { name: /Top Rated/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");

    fetchMock.mockImplementation(async () => answer({ films: [film(2, "The Godfather")] }));
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("The Godfather")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/movies/browse?category=top-rated");
  });
});

describe("DashboardShell, phone", () => {
  beforeEach(() => {
    media.mobile = true;
    vi.stubGlobal("fetch", vi.fn(async () => answer({ films: [] })));
  });
  afterEach(() => vi.unstubAllGlobals());

  // The sheet hands focus back to the toolbar's box when it closes; opening on focus reopened it.
  it("tells the toolbar not to open the sheet on focus", () => {
    render(<DashboardShell />);
    expect(toolbar.props.expandOnFocus).toBe(false);
  });

  it("the sheet's box edits the toolbar's search", async () => {
    render(<DashboardShell />);
    act(() => toolbar.props.onExpand());
    const input = await screen.findByRole("textbox", { name: "Search films" });
    // The sheet takes focus a frame after it opens; a person taps the box after that.
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveFocus());
    await userEvent.type(input, "dune");
    expect(toolbar.props.query).toBe("dune");
  });
});
