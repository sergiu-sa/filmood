/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import FilmDetailPage from "@/app/film/[id]/page";
import { TMDBError } from "@/lib/tmdb-fetch";
import type { FilmDetail } from "@/lib/types";

const NOT_FOUND = new Error("NEXT_NOT_FOUND");
const notFound = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ notFound }));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: null, loading: false }) }));
vi.mock("@/lib/getAuthToken", () => ({ getAuthHeaders: async () => ({}) }));

const filmData = vi.hoisted(() => ({
  getFilmDetail: vi.fn(),
  getRegionalAvailability: vi.fn(),
  getFilmVideos: vi.fn(),
  getFilmImages: vi.fn(),
  getFilmKeywords: vi.fn(),
  getRelatedFilms: vi.fn(),
  getFilmReviews: vi.fn(),
}));
vi.mock("@/lib/filmData", () => filmData);

const detail: FilmDetail = {
  id: 7,
  title: "Film 7",
  overview: "",
  poster_path: null,
  backdrop_path: null,
  release_date: "2020-01-01",
  runtime: 100,
  vote_average: 7,
  genres: [],
  credits: { cast: [], crew: [] },
  external_ids: null,
};

const renderPage = async () => render(await FilmDetailPage({ params: Promise.resolve({ id: "7" }) }));

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  notFound.mockReset().mockImplementation(() => {
    throw NOT_FOUND;
  });
  filmData.getFilmDetail.mockResolvedValue(detail);
  filmData.getRegionalAvailability.mockResolvedValue({ regions: {}, defaultRegion: null });
  filmData.getFilmVideos.mockResolvedValue([]);
  filmData.getFilmImages.mockResolvedValue({ posters: [], backdrops: [] });
  filmData.getFilmKeywords.mockResolvedValue([]);
  filmData.getRelatedFilms.mockResolvedValue({ films: [], source: "similar" });
  filmData.getFilmReviews.mockResolvedValue([]);
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("film page", () => {
  it("shows the not-found page for TMDB's 404 on the film, without logging sections", async () => {
    filmData.getFilmDetail.mockRejectedValue(new TMDBError(404, "/movie/7"));

    await expect(renderPage()).rejects.toBe(NOT_FOUND);
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("hands any other failure on the film to error.tsx", async () => {
    const outage = new TMDBError(503, "/movie/7");
    filmData.getFilmDetail.mockRejectedValue(outage);

    await expect(renderPage()).rejects.toBe(outage);
    expect(notFound).not.toHaveBeenCalled();
  });

  it("says a film with no data has no videos and no streaming info", async () => {
    await renderPage();

    expect(screen.getByText("No videos available")).toBeTruthy();
    expect(screen.getByText("No streaming or release info available")).toBeTruthy();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("leaves a failed section out and says where to watch couldn't load, logging both", async () => {
    filmData.getFilmVideos.mockRejectedValue(new TMDBError(503, "/movie/7/videos"));
    filmData.getRegionalAvailability.mockRejectedValue(new TMDBError(503, "/movie/7/watch/providers"));
    await renderPage();

    expect(screen.queryByText("Videos")).toBeNull();
    expect(screen.queryByText("No videos available")).toBeNull();
    expect(screen.getByText("Couldn't load where to watch.")).toBeTruthy();
    expect(screen.queryByText("No streaming or release info available")).toBeNull();
    expect(consoleError).toHaveBeenCalledWith("Film videos failed", expect.any(TMDBError));
    expect(consoleError).toHaveBeenCalledWith("Film where to watch failed", expect.any(TMDBError));
  });
});
