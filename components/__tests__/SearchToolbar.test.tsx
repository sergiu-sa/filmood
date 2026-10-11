/**
 * @vitest-environment jsdom
 */
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchToolbar from "@/components/dashboard/SearchToolbar";

const baseProps = {
  onCategory: vi.fn(),
  onExpand: vi.fn(),
  onSubmit: vi.fn(),
};

// The shell owns the query; this stands in for it.
function Toolbar(props: { expandOnFocus?: boolean; activeCategory?: string | null; loading?: boolean }) {
  const [query, setQuery] = useState("");
  return <SearchToolbar query={query} onQueryChange={setQuery} activeCategory={null} {...baseProps} {...props} />;
}

const box = () => screen.getByPlaceholderText(/film, actor/i);

describe("SearchToolbar", () => {
  afterEach(() => vi.clearAllMocks());

  it("renders the search input and category pills", () => {
    render(<Toolbar />);
    expect(box()).toBeInTheDocument();
    expect(screen.getByText(/Trending/)).toBeInTheDocument();
    expect(screen.getByText(/Top Rated/)).toBeInTheDocument();
  });

  it("picks a pill's category, and unpicks it when clicked again", () => {
    const { rerender } = render(<Toolbar />);
    fireEvent.click(screen.getByText(/Top Rated/));
    expect(baseProps.onCategory).toHaveBeenLastCalledWith("top-rated");

    rerender(<Toolbar activeCategory="top-rated" />);
    fireEvent.click(screen.getByText(/Top Rated/));
    expect(baseProps.onCategory).toHaveBeenLastCalledWith(null);
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

  it("Enter searches what's in the box, and nothing when it's empty", async () => {
    render(<Toolbar />);
    await userEvent.type(box(), "{Enter}");
    expect(baseProps.onSubmit).not.toHaveBeenCalled();

    await userEvent.type(box(), "dune{Enter}");
    expect(baseProps.onSubmit).toHaveBeenCalledOnce();
  });

  it("shows a spinner while a search is in flight", () => {
    const { container, rerender } = render(<Toolbar />);
    const spinners = () => container.querySelectorAll('[style*="animation: spin"]').length;
    expect(spinners()).toBe(0);
    rerender(<Toolbar loading />);
    expect(spinners()).toBe(1);
  });
});
