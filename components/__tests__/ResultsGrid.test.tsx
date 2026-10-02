/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import ResultsGrid from "@/components/results/ResultsGrid";
import type { DiscoverFilm } from "@/lib/types";

let reduceMotion = false;

vi.mock("@/lib/useMediaQuery", () => ({
  useMediaQuery: (q: string) => q.includes("reduced-motion") && reduceMotion,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));

const LAUGH = { key: "laugh", label: "Need to laugh", accent: "gold" as const };
const DARK = { key: "dark", label: "Go dark", accent: "ember" as const };

const film = (id: number, moodKeys: string[], genre_ids = [18, 35]): DiscoverFilm => ({
  id,
  title: `Film ${id}`,
  poster_path: null,
  release_date: "2020-01-01",
  vote_average: 7,
  vote_count: 1000,
  overview: "",
  genre_ids,
  moodKeys,
});

const headings = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);

describe("ResultsGrid", () => {
  beforeEach(() => {
    reduceMotion = false;
  });

  it("shows More matches for one mood, with the why line and no dots", () => {
    render(<ResultsGrid films={[film(1, ["laugh"])]} moods={[LAUGH]} />);
    expect(headings()).toEqual(["More matches"]);
    expect(screen.getByText("1 film")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("Comedy · Drama");
    expect(screen.queryByText(/^(Fits|From) /)).toBeNull();
  });

  it("puts films that fit both moods first, with the legend beside them", () => {
    render(
      <ResultsGrid
        films={[film(1, ["laugh", "dark"]), film(2, ["laugh"]), film(3, ["dark"])]}
        moods={[LAUGH, DARK]}
      />,
    );
    expect(headings()).toEqual(["Fits both moods", "From each mood"]);
    expect(screen.getByText("2 films, alternating")).toBeInTheDocument();
    const both = screen.getByRole("heading", { name: "Fits both moods" }).closest("section")!;
    expect(both).toHaveTextContent("Need to laugh");
    expect(both).toHaveTextContent("Go dark");
    expect(screen.getByRole("link", { name: /Film 1.*Fits Need to laugh and Go dark/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Film 3.*From Go dark/ })).toBeInTheDocument();
  });

  it("has one heading, with the legend, when no film fits both", () => {
    render(<ResultsGrid films={[film(2, ["laugh"]), film(3, ["dark"])]} moods={[LAUGH, DARK]} />);
    expect(headings()).toEqual(["From each mood"]);
    const section = screen.getByRole("heading", { name: "From each mood" }).closest("section")!;
    expect(section).toHaveTextContent("Need to laugh");
  });

  it("puts the film's moods' genres first in its why line", () => {
    render(<ResultsGrid films={[film(1, ["dark"], [35, 80])]} moods={[LAUGH, DARK]} />);
    expect(screen.getByRole("link")).toHaveTextContent("Crime · Comedy");
  });

  it("drops the stagger under reduced motion", () => {
    const { container, unmount } = render(<ResultsGrid films={[film(1, ["laugh"])]} moods={[LAUGH]} />);
    expect(container.querySelector<HTMLElement>("a")!.parentElement!.style.animation).toContain("fadeUp");
    unmount();

    reduceMotion = true;
    const again = render(<ResultsGrid films={[film(1, ["laugh"])]} moods={[LAUGH]} />);
    expect(again.container.querySelector<HTMLElement>("a")!.parentElement!.getAttribute("style")).toBeNull();
  });

  it("renders nothing without films", () => {
    const { container } = render(<ResultsGrid films={[]} moods={[LAUGH]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
