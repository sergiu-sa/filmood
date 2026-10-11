/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchToolbar from "@/components/dashboard/SearchToolbar";

const baseProps = {
  onResults: vi.fn(),
  onFailed: vi.fn(),
  onActiveCategory: vi.fn(),
  onExpand: vi.fn(),
};

// The shell owns the query; this stands in for it.
function Toolbar(props: { expandOnFocus?: boolean }) {
  const [query, setQuery] = useState("");
  return <SearchToolbar query={query} onQueryChange={setQuery} {...baseProps} {...props} />;
}

const box = () => screen.getByPlaceholderText(/film, actor/i);
const dune = [{ id: 1, title: "Dune" }];
const answer = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: async () => body } as Response);

describe("SearchToolbar", () => {
  const fetchMock = vi.fn();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
    vi.clearAllMocks();
  });

  it("renders the search input and category pills", () => {
    render(<Toolbar />);
    expect(box()).toBeInTheDocument();
    expect(screen.getByText(/Trending/)).toBeInTheDocument();
    expect(screen.getByText(/Top Rated/)).toBeInTheDocument();
  });

  it("fires onExpand when a pill is clicked", () => {
    render(<Toolbar />);
    fireEvent.click(screen.getByText(/Trending/));
    expect(baseProps.onExpand).toHaveBeenCalled();
  });

  it("fires onExpand when the input receives focus", () => {
    render(<Toolbar />);
    fireEvent.focus(box());
    expect(baseProps.onExpand).toHaveBeenCalled();
  });

  // The phone sheet hands focus back to this box when it closes; opening on focus reopened it.
  it("on phones, opens on a tap but not on focus", () => {
    render(<Toolbar expandOnFocus={false} />);
    fireEvent.focus(box());
    expect(baseProps.onExpand).not.toHaveBeenCalled();
    fireEvent.click(box());
    expect(baseProps.onExpand).toHaveBeenCalledOnce();
  });

  it("reports the films with the search they answer", async () => {
    fetchMock.mockImplementation(() => answer({ films: dune }));
    render(<Toolbar />);
    await userEvent.type(box(), " dune ");

    await waitFor(() => expect(baseProps.onResults).toHaveBeenCalledWith(dune, "dune"));
    expect(fetchMock).toHaveBeenCalledWith("/api/movies/search?query=dune&type=all", expect.anything());
  });

  it("reports a failed search as a failure, not as no films", async () => {
    fetchMock.mockImplementation(() => answer({ error: "Failed to search films" }, 500));
    render(<Toolbar />);
    await userEvent.type(box(), "dune");

    await waitFor(() => expect(baseProps.onFailed).toHaveBeenCalledWith("dune", expect.any(Function)));
    expect(baseProps.onResults).not.toHaveBeenCalledWith(expect.anything(), "dune");

    fetchMock.mockImplementation(() => answer({ films: dune }));
    baseProps.onFailed.mock.calls[0][1]();
    await waitFor(() => expect(baseProps.onResults).toHaveBeenCalledWith(dune, "dune"));
  });

  it("drops an answer that lands after the box is cleared", async () => {
    let settle: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (settle = r)));
    render(<Toolbar />);
    await userEvent.type(box(), "dune");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    await userEvent.clear(box());
    expect(baseProps.onResults).toHaveBeenLastCalledWith([], "");
    settle({ ok: true, status: 200, json: async () => ({ films: dune }) } as Response);
    await new Promise((r) => setTimeout(r, 0));

    expect(baseProps.onResults).not.toHaveBeenCalledWith(dune, "dune");
  });
});
