/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import TopPick, { ResultsTopPick } from "@/components/results/TopPick";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";

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

const film = {
  id: 7,
  title: "Barbie",
  poster_path: "/barbie.jpg",
  release_date: "2023-07-19",
  vote_average: 7,
  overview: "Barbie leaves Barbieland.",
};

function renderPick(why: { keywords: string[]; genres: string[] }) {
  return render(
    <TopPick
      film={film}
      moods={["easy"]}
      accent={{ base: "var(--teal)", soft: "var(--teal-soft)", glow: "var(--teal-glow)" }}
      providers={[]}
      providersLoading={false}
      why={why}
    />,
  );
}

describe("TopPick", () => {
  beforeEach(() => {
    reduceMotion = false;
  });

  it("names the matching keywords, then the genres", () => {
    renderPick({ keywords: ["feelgood", "heartwarming"], genres: ["Comedy", "Drama"] });
    expect(screen.getByText("Why").parentElement).toHaveTextContent(
      "Whytagged feelgood · heartwarming — Comedy · Drama",
    );
  });

  it("shows only the genres when no keyword matched", () => {
    renderPick({ keywords: [], genres: ["Comedy", "Adventure"] });
    const line = screen.getByText("Why").parentElement;
    expect(line).toHaveTextContent("WhyComedy · Adventure");
    expect(line).not.toHaveTextContent("tagged");
  });

  it("has no Why line with nothing to say", () => {
    renderPick({ keywords: [], genres: [] });
    expect(screen.queryByText("Why")).toBeNull();
  });

  it("keeps the title and link the e2e specs find", () => {
    renderPick({ keywords: [], genres: ["Comedy"] });
    expect(screen.getByRole("heading", { level: 2, name: "Barbie" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view details/i })).toHaveAttribute("href", "/film/7");
  });

  it("stops the glow under reduced motion", () => {
    const { container, unmount } = renderPick({ keywords: [], genres: [] });
    const glow = () => container.querySelector<HTMLElement>('[aria-hidden="true"]')!;
    expect(glow().style.animation).toContain("breathe");
    unmount();

    reduceMotion = true;
    const again = renderPick({ keywords: [], genres: [] });
    expect(again.container.querySelector<HTMLElement>('[aria-hidden="true"]')!.style.animation).toBe("none");
  });
});

describe("ResultsTopPick", () => {
  const easy = { key: "easy", label: "Need a hug", accent: "teal" as const };
  const pick = { ...film, vote_count: 900, genre_ids: [18, 35], moodKeys: ["easy"] };

  function answer(keywords: Response | Promise<never>) {
    vi.mocked(fetch).mockImplementation((input) =>
      String(input).endsWith("/keywords")
        ? keywords instanceof Promise
          ? keywords
          : Promise.resolve(keywords)
        : Promise.resolve(Response.json({ providers: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/n.jpg" }] })),
    );
  }

  it("fetches this film's providers and keywords and builds the Why line", async () => {
    const heist = { id: TMDB_KEYWORDS.heist.id, name: "heist" };
    const feelgood = { id: TMDB_KEYWORDS.feelGood.id, name: "feelgood" };
    answer(Response.json({ keywords: [heist, feelgood] }));
    render(<ResultsTopPick film={pick} mood={easy} />);

    expect(await screen.findByAltText("Netflix")).toBeInTheDocument();
    expect(await screen.findByText("feelgood")).toBeInTheDocument();
    expect(screen.getByText("Why").parentElement).toHaveTextContent("Whytagged feelgood — Drama · Comedy");
    expect(fetch).toHaveBeenCalledWith("/api/movies/7/providers");
    expect(fetch).toHaveBeenCalledWith("/api/movies/7/keywords");
  });

  it("keeps the genres when the keywords call fails", async () => {
    answer(Promise.reject(new Error("offline")));
    render(<ResultsTopPick film={pick} mood={easy} />);

    expect(await screen.findByAltText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Why").parentElement).toHaveTextContent("WhyDrama · Comedy");
  });
});

