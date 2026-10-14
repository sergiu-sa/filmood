/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import TrendingBox from "@/components/dashboard/TrendingBox";

describe("TrendingBox", () => {
  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            films: Array.from({ length: 7 }).map((_, i) => ({
              id: i, title: `Film ${i}`, genre_ids: [28], poster_path: "/p.jpg",
            })),
          }),
      } as Response),
    );
  });
  afterEach(() => vi.clearAllMocks());

  it("renders the 'Trending today' label", () => {
    render(<TrendingBox onExpand={vi.fn()} isCollapsed={false} />);
    expect(screen.getByText(/Trending today/i)).toBeInTheDocument();
  });

  it("fetches and shows top 5 films", async () => {
    render(<TrendingBox onExpand={vi.fn()} isCollapsed={false} />);
    await waitFor(() => expect(screen.getByText("Film 0")).toBeInTheDocument());
    // Only 5 rendered
    expect(screen.queryByText("Film 5")).not.toBeInTheDocument();
  });

  // A role="button" box around the film links put controls inside a control.
  it("is no button itself; its one button says whether search is open", async () => {
    const { container, rerender } = render(<TrendingBox onExpand={vi.fn()} isExpanded={false} />);
    await waitFor(() => expect(screen.getByText("Film 0")).toBeInTheDocument());
    expect(container.querySelector('[role="button"], [tabindex]')).toBeNull();
    const button = screen.getByRole("button");
    expect(button).toHaveAccessibleName("Browse & search");
    expect(button).toHaveAttribute("aria-expanded", "false");

    rerender(<TrendingBox onExpand={vi.fn()} isExpanded />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
  });

  it("opens search once from its button, and from a click anywhere on the box", () => {
    const onExpand = vi.fn();
    render(<TrendingBox onExpand={onExpand} isExpanded={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Browse & search" }));
    expect(onExpand).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("heading", { name: "Trending today" }));
    expect(onExpand).toHaveBeenCalledTimes(2);
  });
});
