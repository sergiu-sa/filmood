/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import ResultsNotice, { describeAsk } from "@/components/results/ResultsNotice";
import { moodMap } from "@/lib/moodMap";
import type { AppliedFilters, DiscoverResponse } from "@/lib/types";

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

const DATE_NIGHT = { key: "datenight", label: "Date night", accent: "rose" as const };
const NONE: AppliedFilters = { time: null, era: null, where: "any" };

const base = {
  count: 0,
  moods: [DATE_NIGHT],
  filters: NONE,
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

    // The page's h1 is the mood header's, so this is a level 2, and the only one.
    expect(screen.getByRole("heading", { level: 2, name: /nothing fits all of that/i })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument();
    expect(screen.queryByText(/only \d+ films? match/i)).not.toBeInTheDocument();
    expect(screen.getByText("Nothing for Date night right now. Loosen one filter:")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Any era · 146 films", "Any length · 1 film"]);

    const links = screen.getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "/results?mood=easy&src=related",
      "/results?mood=datenight&src=related",
      "/results?mood=family&src=related",
    ]);
    expect(links.map((a) => a.getAttribute("aria-label"))).toEqual(
      ["easy", "datenight", "family"].map((k) => `${moodMap[k].tagLabel} — ${moodMap[k].description}`),
    );
  });

  it("makes every suggestion button at least 44px tall", () => {
    const { rerender } = render(<ResultsNotice {...base} suggestions={[{ remove: "era", total: 9 }]} />);
    const tall = () =>
      screen.getAllByRole("button").forEach((b) => expect(parseFloat(b.style.minHeight)).toBeGreaterThanOrEqual(44));
    tall();
    rerender(<ResultsNotice {...base} count={3} suggestions={[{ remove: "era", total: 9 }]} />);
    tall();
  });

  it("empty with no suggestions still offers related moods", () => {
    render(<ResultsNotice {...base} relatedMoods={["easy"]} />);
    expect(screen.getByRole("heading", { name: /nothing fits/i })).toBeInTheDocument();
    expect(screen.getByText("Nothing for Date night right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: new RegExp(moodMap.easy.tagLabel) })).toBeInTheDocument();
  });

  it("thin: a heading and buttons, no empty heading or related moods", () => {
    render(
      <ResultsNotice
        {...base}
        count={5}
        suggestions={[{ remove: "era", total: 64 }]}
        relatedMoods={["easy"]}
      />,
    );

    expect(screen.getByRole("region", { name: "Only 5 films match all of that." })).toBeInTheDocument();
    expect(screen.getByText("Loosen one filter to see more.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Any era · 64 films" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual(["Only 5 films match all of that."]);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("thin with one film reads in the singular", () => {
    render(<ResultsNotice {...base} count={1} suggestions={[{ remove: "era", total: 9 }]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Only 1 film matches all of that." })).toBeInTheDocument();
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

describe("describeAsk", () => {
  const ask = (f: Partial<AppliedFilters>, moods: DiscoverResponse["moods"] = [DATE_NIGHT]) =>
    describeAsk(moods, { ...NONE, ...f });

  it("names every era, time and where", () => {
    expect(ask({ era: "classic" })).toBe("Nothing for Date night from before 1990 right now.");
    expect(ask({ era: "modern" })).toBe("Nothing for Date night from 1990–2009 right now.");
    expect(ask({ era: "fresh" })).toBe("Nothing for Date night from 2010 on right now.");
    expect(ask({ time: "short" })).toBe("Nothing for Date night under 100 minutes right now.");
    expect(ask({ time: "medium" })).toBe("Nothing for Date night under 2 hours right now.");
    expect(ask({ time: "long" })).toBe("Nothing for Date night at 2 h 20 or longer right now.");
    expect(ask({ where: "mine" })).toBe("Nothing for Date night on your services right now.");
    expect(ask({ where: "norway" })).toBe("Nothing for Date night streaming in Norway right now.");
  });

  it("joins the clauses in the drawn order", () => {
    expect(ask({ era: "classic", time: "short", where: "mine" })).toBe(
      "Nothing for Date night from before 1990, under 100 minutes, on your services right now.",
    );
  });

  it("joins two moods with a plus", () => {
    const laugh = { key: "laugh", label: "Need to laugh", accent: "gold" as const };
    const dark = { key: "dark", label: "Go dark", accent: "ember" as const };
    expect(ask({ where: "norway" }, [laugh, dark])).toBe(
      "Nothing for Need to laugh + Go dark streaming in Norway right now.",
    );
  });

  it("has no clauses for Anywhere with nothing else set", () => {
    expect(ask({})).toBe("Nothing for Date night right now.");
  });
});
