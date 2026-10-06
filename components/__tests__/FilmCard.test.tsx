/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import FilmCard from "@/components/film/FilmCard";

// ── Module mocks ───────────────────────────────────────────────────────────
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

vi.mock("next/image", () => ({
  default: ({
    src,
    alt,
    fill: _fill,
    sizes: _sizes,
    ...rest
  }: {
    src: string;
    alt: string;
    fill?: boolean;
    sizes?: string;
    [key: string]: unknown;
  }) => <img src={src} alt={alt} {...rest} />,
}));

// ── Shared props ───────────────────────────────────────────────────────────
const baseFilm = {
  id: 42,
  title: "Inception",
  posterPath: "/inception.jpg" as string | null,
  releaseDate: "2010-07-16",
  voteAverage: 8.8,
  overview: "A thief who steals corporate secrets through the dream world.",
};

describe("FilmCard", () => {
  it("renders the film title", () => {
    render(<FilmCard {...baseFilm} />);
    expect(screen.getByText("Inception")).toBeInTheDocument();
  });

  it("renders a poster image with the correct TMDB src", () => {
    render(<FilmCard {...baseFilm} />);
    const img = screen.getByAltText("Inception");
    expect(img).toHaveAttribute(
      "src",
      "https://image.tmdb.org/t/p/w500/inception.jpg",
    );
  });

  it('shows the "No Poster" fallback when posterPath is null', () => {
    render(<FilmCard {...baseFilm} posterPath={null} />);
    expect(screen.getByText("No Poster")).toBeInTheDocument();
    expect(screen.queryByAltText("Inception")).not.toBeInTheDocument();
  });

  it("renders the release year extracted from releaseDate", () => {
    render(<FilmCard {...baseFilm} />);
    expect(screen.getByText("2010")).toBeInTheDocument();
  });

  it("renders the rating badge formatted to one decimal place", () => {
    render(<FilmCard {...baseFilm} />);
    expect(screen.getByText("★ 8.8")).toBeInTheDocument();
  });

  it("links to the correct film page", () => {
    render(<FilmCard {...baseFilm} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/film/42");
  });

  it("renders the film overview text", () => {
    render(<FilmCard {...baseFilm} />);
    expect(
      screen.getByText(/A thief who steals corporate secrets/),
    ).toBeInTheDocument();
  });

  it("shows a non-breaking space when overview is empty (preserves card height)", () => {
    render(<FilmCard {...baseFilm} overview="" />);
    // The component renders \u00A0 (nbsp) for empty overview
    const p = document.querySelector("p:last-of-type");
    expect(p).toBeInTheDocument();
  });

  // Browse and the rails pass neither prop; their cards must not change.
  it("renders the same markup without reason or moodDots", () => {
    const { container } = render(<FilmCard {...baseFilm} />);
    expect(container.innerHTML).toMatchInlineSnapshot(`"<a href="/film/42" class="group film-card-link" style="text-decoration: none; --accent-on-card: var(--gold);"><div class="film-card-frame" style="border-radius: var(--r); overflow: hidden; background: var(--surface); border: 1px solid var(--border);"><div class="relative" style="aspect-ratio: 2/3; background: var(--surface2);"><img alt="Inception" class="object-cover" style="transition: transform var(--t-slow);" src="https://image.tmdb.org/t/p/w500/inception.jpg"><div class="always-dark-accents" style="position: absolute; top: 10px; right: 10px; display: inline-flex; align-items: center; gap: 4px; padding: 5px 9px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1; color: rgb(var(--gold-rgb)); background: var(--overlay-heavy); border: 1px solid rgba(255, 255, 255, 0.06); box-shadow: 0 6px 18px rgba(0,0,0,0.24); z-index: 2;">★ 8.8</div></div><div style="padding: 10px 12px 12px; min-height: 90px;"><h3 style="font-size: 13px; font-weight: 600; color: var(--t1); margin: 0px 0px 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Inception</h3><div style="display: flex; align-items: center; gap: 8px;"><span style="font-size: 11px; color: var(--t3);">2010</span></div><p style="font-size: 11px; color: var(--t2); margin-top: 6px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; overflow: hidden;">A thief who steals corporate secrets through the dream world.</p></div></div></a>"`);
  });

  it("renders the reason with a separator", () => {
    render(<FilmCard {...baseFilm} reason={["Comedy", "Crime"]} />);
    expect(screen.getByText("Comedy")).toBeInTheDocument();
    expect(screen.getByText("Comedy").parentElement).toHaveTextContent("Comedy · Crime");
  });

  it("names the moods in the link, not with the dots", () => {
    const { container, rerender } = render(
      <FilmCard
        {...baseFilm}
        moodDots={[
          { color: "var(--gold)", label: "Need to laugh" },
          { color: "var(--ember)", label: "Go dark" },
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Fits Need to laugh and Go dark/ })).toBeInTheDocument();
    expect(container.querySelector('[aria-hidden="true"]')?.children).toHaveLength(2);

    rerender(<FilmCard {...baseFilm} moodDots={[{ color: "var(--ember)", label: "Go dark" }]} />);
    expect(screen.getByRole("link", { name: /From Go dark/ })).toBeInTheDocument();
  });
});
