/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsNotice from "@/components/results/ResultsNotice";
import { moodMap } from "@/lib/moodMap";

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

const labels = { era: "Any era", time: "Any length" };

const base = {
  count: 0,
  suggestions: [],
  relatedMoods: [],
  relaxed: 0 as const,
  partial: false,
  labels,
  onRemove: () => {},
};

describe("ResultsNotice", () => {
  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<ResultsNotice {...base} count={20} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("empty: heading, suggestions in the order given, then related moods", () => {
    render(
      <ResultsNotice
        {...base}
        suggestions={[
          { remove: "era", total: 146 },
          { remove: "time", total: 1 },
        ]}
        relatedMoods={["easy", "datenight", "family"]}
      />,
    );

    expect(screen.getByRole("heading", { name: /nothing fits all of that/i })).toBeInTheDocument();
    expect(screen.queryByText(/only \d+ films? match/i)).not.toBeInTheDocument();

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Any era · 146 films", "Any length · 1 film"]);

    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/results?mood=easy&src=related",
      "/results?mood=datenight&src=related",
      "/results?mood=family&src=related",
    ]);
    expect(links.map((a) => a.textContent)).toEqual([
      moodMap.easy.tagLabel,
      moodMap.datenight.tagLabel,
      moodMap.family.tagLabel,
    ]);
  });

  it("empty with no suggestions still offers related moods", () => {
    render(<ResultsNotice {...base} relatedMoods={["easy"]} />);
    expect(screen.getByRole("heading", { name: /nothing fits/i })).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: moodMap.easy.tagLabel })).toBeInTheDocument();
  });

  it("thin: a one-line notice and buttons, no empty heading or related moods", () => {
    render(
      <ResultsNotice
        {...base}
        count={5}
        suggestions={[{ remove: "era", total: 64 }]}
        relatedMoods={["easy"]}
      />,
    );

    expect(screen.getByText("Only 5 films match. Loosen one filter:")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Any era · 64 films" })).toBeInTheDocument();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("thin with one film reads in the singular", () => {
    render(<ResultsNotice {...base} count={1} suggestions={[{ remove: "era", total: 9 }]} />);
    expect(screen.getByText("Only 1 film matches. Loosen one filter:")).toBeInTheDocument();
  });

  it("passes the suggestion's param to onRemove", () => {
    const onRemove = vi.fn();
    render(
      <ResultsNotice
        {...base}
        count={3}
        suggestions={[
          { remove: "era", total: 40 },
          { remove: "time", total: 12 },
        ]}
        onRemove={onRemove}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /any length/i }));
    expect(onRemove).toHaveBeenCalledExactlyOnceWith("time");
  });

  it("falls back to the filter key when a label is missing", () => {
    render(<ResultsNotice {...base} suggestions={[{ remove: "where", total: 30 }]} />);
    expect(screen.getByRole("button", { name: "where · 30 films" })).toBeInTheDocument();
  });

  it("relaxed: a quiet note, but not over an empty result", () => {
    const { rerender } = render(<ResultsNotice {...base} count={20} relaxed={2} />);
    expect(screen.getByText("Widened a little to find enough films.")).toBeInTheDocument();

    rerender(<ResultsNotice {...base} count={0} relaxed={2} />);
    expect(screen.queryByText(/widened a little/i)).not.toBeInTheDocument();
  });

  it("relaxed: stays quiet when the thin notice already says to loosen a filter", () => {
    render(
      <ResultsNotice {...base} count={5} relaxed={1} suggestions={[{ remove: "era", total: 64 }]} />,
    );
    expect(screen.getByText(/only 5 films match/i)).toBeInTheDocument();
    expect(screen.queryByText(/widened a little/i)).not.toBeInTheDocument();
  });

  it("partial: says one mood failed", () => {
    render(<ResultsNotice {...base} count={14} partial />);
    expect(
      screen.getByText("One of your moods couldn't load — showing the other."),
    ).toBeInTheDocument();
  });
});
