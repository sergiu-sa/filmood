/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BrowsePage from "@/app/browse/page";

const nav = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/lib/useMediaQuery", () => ({ useMediaQuery: () => false }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const film = (id: number, title: string) => ({ id, title, poster_path: null, release_date: "2020-01-01", vote_average: 7, overview: "" });
const answer = (body: unknown, status = 200) => Promise.resolve(Response.json(body, { status }));
const card = (name: string) => screen.queryByRole("heading", { level: 3, name });
const h1 = () => screen.getByRole("heading", { level: 1 });
const box = () => screen.getByRole("textbox", { name: "Search films" });

const fetchMock = vi.fn();
let onSearch: (query: string) => Promise<Response>;
let onBrowse: (params: URLSearchParams) => Promise<Response>;
const calls = (path: string) => fetchMock.mock.calls.map(([url]) => String(url)).filter((u) => u.startsWith(path));
const searches = () => calls("/api/movies/search");

/** Opens /browse with `query` as its search string, as a link or Back would. */
function open(query = "") {
  nav.params = new URLSearchParams(query);
  window.history.replaceState(null, "", `/browse${query ? `?${query}` : ""}`);
  return render(<BrowsePage />);
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    const u = new URL(url, "http://localhost");
    return u.pathname === "/api/movies/search" ? onSearch(u.searchParams.get("query")!) : onBrowse(u.searchParams);
  });
  vi.stubGlobal("fetch", fetchMock);
  onSearch = () => answer({ films: [film(1, "Dune"), film(2, "Dune: Part Two")] });
  onBrowse = () => answer({ films: [film(9, "Trending film")], totalPages: 1 });
});

afterEach(() => vi.unstubAllGlobals());

describe("/browse search", () => {
  it("a shared ?q= link runs the same search as home", async () => {
    open("q=dune");
    expect(await screen.findByRole("heading", { level: 3, name: "Dune: Part Two" })).toBeInTheDocument();
    expect(h1()).toHaveTextContent("Results for “dune”");
    expect(box()).toHaveValue("dune");
    expect(searches()).toEqual(["/api/movies/search?query=dune&type=all"]);
    expect(card("Trending film")).not.toBeInTheDocument();
    // The category isn't fetched under a search nobody has cleared yet.
    expect(calls("/api/movies/browse")).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Trending film" })).toBeInTheDocument();
  });

  it("typing searches TMDB and keeps it in the URL; clearing brings the category back at once", async () => {
    open();
    await screen.findByRole("heading", { level: 3, name: "Trending film" });

    await userEvent.type(box(), "dune");
    expect(await screen.findByRole("heading", { level: 3, name: "Dune" })).toBeInTheDocument();
    expect(window.location.search).toBe("?q=dune");

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(h1()).toHaveTextContent("Trending today");
    expect(card("Trending film")).toBeInTheDocument();
    expect(box()).toHaveFocus();
    await waitFor(() => expect(window.location.search).toBe(""));
  });

  it("follows the URL when Back or a link changes q under the box", async () => {
    const { rerender } = open("q=dune");
    await screen.findByRole("heading", { level: 3, name: "Dune" });

    nav.params = new URLSearchParams();
    rerender(<BrowsePage />);
    expect(box()).toHaveValue("");
    expect(h1()).toHaveTextContent("Trending today");
  });

  it("never lets an older search's late answer replace a newer one", async () => {
    let settleOld: (r: Response) => void = () => {};
    onSearch = (q) => (q === "du" ? new Promise((r) => (settleOld = r)) : answer({ films: [film(1, "Dune")] }));
    open();

    await userEvent.type(box(), "du");
    await waitFor(() => expect(searches()).toHaveLength(1));
    await userEvent.type(box(), "ne");
    await screen.findByRole("heading", { level: 3, name: "Dune" });

    settleOld(Response.json({ films: [film(3, "Dumbo")] }));
    await new Promise((r) => setTimeout(r, 0));
    expect(card("Dune")).toBeInTheDocument();
    expect(card("Dumbo")).not.toBeInTheDocument();
  });

  it("shows a failed search as an error; Try again runs it again", async () => {
    onSearch = () => answer({ error: "Failed to search films" }, 500);
    open("q=dune");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");

    onSearch = () => answer({ films: [film(1, "Dune")] });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(h1()).toHaveFocus();
    expect(await screen.findByRole("heading", { level: 3, name: "Dune" })).toBeInTheDocument();
  });
});

describe("/browse categories", () => {
  it("pages past 20, up to TMDB's 500", async () => {
    onBrowse = () => answer({ films: [film(9, "Trending film")], totalPages: 1000 });
    open();
    await userEvent.click(await screen.findByRole("button", { name: "500" }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith("/api/movies/browse?category=trending&page=500", expect.anything()),
    );
  });

  it("shows an outage as an error, not as no films; Try again fetches again", async () => {
    onBrowse = () => answer({ error: "Failed to browse films" }, 500);
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the film database.");
    expect(screen.queryByText("No films found")).not.toBeInTheDocument();

    onBrowse = () => answer({ films: [film(9, "Trending film")], totalPages: 1 });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { level: 3, name: "Trending film" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  // A hand-edited link: the same request would get the same 400.
  it("shows a 400 as the route's message, without Try again", async () => {
    onBrowse = () => answer({ error: "Invalid genre" }, 400);
    open("genre=1.5");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid genre");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});
