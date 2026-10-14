/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchPanel from "@/components/dashboard/SearchPanel";
import type { Film } from "@/lib/types";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ── Test films ─────────────────────────────────────────────────────────────
function makeFilm(id: number, title: string): Film {
  return {
    id,
    title,
    poster_path: null,
    release_date: "2023-01-01",
    vote_average: 7.0,
    overview: `Overview of ${title}`,
  };
}

// 20 films, a full TMDB page: Film A … Film T
const FILMS: Film[] = Array.from({ length: 20 }, (_, i) =>
  makeFilm(i + 1, `Film ${String.fromCharCode(65 + i)}`),
);

const defaultProps = {
  isOpen: true,
  embedded: true, // skip animation wrapper for simpler DOM assertions
  films: FILMS,
  activeCategory: null as string | null,
  activeGenre: null as number | null,
  onCategoryChange: vi.fn(),
  onClose: vi.fn(),
};

describe("SearchPanel", () => {
  afterEach(() => vi.clearAllMocks());

  // The phone sheet's controls are 44px targets; the desktop panel keeps its compact sizes.
  it.each([true, false])("sizes its controls for the phone sheet only (embedded: %s)", (embedded) => {
    const { container } = render(
      <SearchPanel {...defaultProps} embedded={embedded} activeCategory="by-genre" onSearchTextChange={embedded ? vi.fn() : undefined} />,
    );
    const off = [...container.querySelectorAll<HTMLElement>("button, select, a[href]:not([href^='/film/'])")]
      .filter((el) => el.style.minHeight !== (embedded ? "44px" : ""))
      .map((el) => el.textContent);
    expect(off).toEqual([]);
  });

  // ── Static structure ─────────────────────────────────────────────────────
  it('renders the "Browse" section label', () => {
    render(<SearchPanel {...defaultProps} />);
    expect(screen.getByText(/browse/i)).toBeInTheDocument();
  });

  it("renders all 6 category tab buttons", () => {
    render(<SearchPanel {...defaultProps} />);
    expect(
      screen.getByRole("button", { name: /trending/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /top rated/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /new releases/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /in cinemas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /by genre/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /streaming in norway/i }),
    ).toBeInTheDocument();
  });

  it('points "Full search" at a bare /browse when nothing is chosen', () => {
    render(<SearchPanel {...defaultProps} />);
    const link = screen.getByRole("link", { name: /full search/i });
    expect(link).toHaveAttribute("href", "/browse");
  });

  it('"Full search" carries the search, so browse runs it', () => {
    render(<SearchPanel {...defaultProps} query="the dark knight" />);
    expect(screen.getByRole("link", { name: /full search/i })).toHaveAttribute(
      "href",
      "/browse?q=the+dark+knight",
    );
  });

  it('"Full search" carries a category', () => {
    render(<SearchPanel {...defaultProps} activeCategory="by-genre" activeGenre={35} />);
    expect(screen.getByRole("link", { name: /full search/i })).toHaveAttribute(
      "href",
      "/browse?category=by-genre&genre=35",
    );
  });

  it("renders the Close button", () => {
    render(<SearchPanel {...defaultProps} />);
    expect(screen.getByRole("button", { name: /close/i })).toBeInTheDocument();
  });

  // ── Films and search ──────────────────────────────────────────────────────
  it("shows every film of the page, and says how many", () => {
    render(<SearchPanel {...defaultProps} query="film" />);
    expect(screen.getByText("Film A")).toBeInTheDocument();
    expect(screen.getByText("Film T")).toBeInTheDocument();
    expect(screen.getByText(/Showing/).textContent).toBe('Showing 20 films matching "film"');
  });

  it("has no search box on desktop: the toolbar above is the search", () => {
    render(<SearchPanel {...defaultProps} embedded={false} />);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("the phone sheet's box edits the search", async () => {
    const onSearchTextChange = vi.fn();
    render(<SearchPanel {...defaultProps} searchText="dun" onSearchTextChange={onSearchTextChange} />);
    const input = screen.getByRole("textbox", { name: "Search films" });
    expect(input).toHaveValue("dun");

    await userEvent.type(input, "e");
    expect(onSearchTextChange).toHaveBeenLastCalledWith("dune");

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onSearchTextChange).toHaveBeenLastCalledWith("");
    expect(input).toHaveFocus();
  });

  it("says a search found nothing", () => {
    render(<SearchPanel {...defaultProps} films={[]} query="xyzxyz" />);
    expect(screen.getByText('No films matching "xyzxyz"')).toBeInTheDocument();
  });

  it("Enter in the sheet's box searches now and keeps focus in the sheet", async () => {
    const onSearchSubmit = vi.fn();
    render(
      <SearchPanel {...defaultProps} searchText="dune" onSearchTextChange={vi.fn()} onSearchSubmit={onSearchSubmit} />,
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Search films" }), "{Enter}");
    expect(onSearchSubmit).toHaveBeenCalledOnce();
    // A blur dropped focus to <body>, outside the sheet's focus trap; the heading puts the keyboard away instead.
    expect(screen.getByRole("heading", { level: 3, name: "Browse & Search" })).toHaveFocus();
  });

  it("shows a failed load as an error with Try again, not as films", async () => {
    const onRetry = vi.fn();
    render(
      <SearchPanel
        {...defaultProps}
        error={{ message: "Couldn't reach the film database.", retryable: true }}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't reach the film database.");
    expect(screen.queryByText("Film A")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    // The button goes with the error, so focus moves to the panel's heading.
    expect(screen.getByRole("heading", { level: 3, name: "Browse & Search" })).toHaveFocus();
  });

  // ── Category tabs ─────────────────────────────────────────────────────────
  it("calls onCategoryChange with correct id when a tab is clicked", () => {
    render(<SearchPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /top rated/i }));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("top-rated");
  });

  it("calls onCategoryChange('trending') when Trending tab is clicked", () => {
    render(<SearchPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /^trending$/i }));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("trending");
  });

  // ── Genre chips ───────────────────────────────────────────────────────────
  it("does NOT render genre chips when activeCategory is not 'by-genre'", () => {
    render(<SearchPanel {...defaultProps} activeCategory="trending" />);
    expect(screen.queryByText("Action")).not.toBeInTheDocument();
    expect(screen.queryByText("Comedy")).not.toBeInTheDocument();
  });

  it("renders genre chips when activeCategory is 'by-genre'", () => {
    render(<SearchPanel {...defaultProps} activeCategory="by-genre" />);
    expect(screen.getByText("Action")).toBeInTheDocument();
    expect(screen.getByText("Comedy")).toBeInTheDocument();
    expect(screen.getByText("Drama")).toBeInTheDocument();
  });

  it("calls onCategoryChange('by-genre', genreId) when a genre chip is clicked", () => {
    render(<SearchPanel {...defaultProps} activeCategory="by-genre" />);
    fireEvent.click(screen.getByRole("button", { name: "Action" }));
    expect(defaultProps.onCategoryChange).toHaveBeenCalledWith("by-genre", 28);
  });

  // ── Close button ──────────────────────────────────────────────────────────
  it("calls onClose when the Close button is clicked", () => {
    render(<SearchPanel {...defaultProps} />);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(defaultProps.onClose).toHaveBeenCalledOnce();
  });

  // ── Animation wrapper (non-embedded) ─────────────────────────────────────
  it("collapses via gridTemplateRows:0fr when isOpen=false and not embedded", () => {
    const { container } = render(
      <SearchPanel {...defaultProps} embedded={false} isOpen={false} />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.gridTemplateRows).toBe("0fr");
    // Collapsed, it's only hidden visually; inert keeps its controls out of the Tab order.
    expect(wrapper).toHaveAttribute("inert");
  });

  it("expands via gridTemplateRows:1fr when isOpen=true and not embedded", () => {
    const { container } = render(
      <SearchPanel {...defaultProps} embedded={false} isOpen />,
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.gridTemplateRows).toBe("1fr");
    expect(wrapper).not.toHaveAttribute("inert");
  });
});
