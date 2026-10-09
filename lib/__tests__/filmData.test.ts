import {
  getFilmDetail,
  getFilmReviews,
  getFilmVideos,
  getRegionalAvailability,
  getRelatedFilms,
} from "@/lib/filmData";
import { TMDBError } from "@/lib/tmdb-fetch";
import { mockTMDB } from "@/lib/__tests__/helpers/tmdb-mock";

const provider = (id: number, name: string) => ({
  provider_id: id,
  provider_name: name,
  logo_path: `/${name}.png`,
  display_priority: 1,
});

beforeEach(() => {
  vi.unstubAllGlobals();
  process.env.TMDB_API_KEY = "test-key";
});

describe("getRegionalAvailability", () => {
  const releaseDates = {
    results: [
      {
        iso_3166_1: "NO",
        release_dates: [
          { type: 4, certification: "12", release_date: "2020-03-01" },
          { type: 3, certification: "15", release_date: "2020-02-01" },
        ],
      },
      { iso_3166_1: "US", release_dates: [{ type: 3, certification: "R", release_date: "2020-01-10" }] },
    ],
  };

  it("merges providers and release dates per country, with Norway as the default", async () => {
    mockTMDB({
      "/movie/7/watch/providers": {
        results: {
          SE: { flatrate: [provider(8, "Netflix")] },
          NO: { flatrate: [provider(8, "Netflix")], rent: [provider(8, "Netflix"), provider(2, "Apple")] },
        },
      },
      "/movie/7/release_dates": releaseDates,
    });

    expect(await getRegionalAvailability(7)).toEqual({
      regions: {
        SE: { providers: [{ provider_id: 8, provider_name: "Netflix", logo_path: "/Netflix.png" }], certification: null, release_date: null },
        NO: {
          providers: [
            { provider_id: 8, provider_name: "Netflix", logo_path: "/Netflix.png" },
            { provider_id: 2, provider_name: "Apple", logo_path: "/Apple.png" },
          ],
          certification: "15",
          release_date: "2020-02-01",
        },
        US: { providers: [], certification: "R", release_date: "2020-01-10" },
      },
      defaultRegion: "NO",
    });
  });

  it("defaults to the first region when Norway has no data", async () => {
    mockTMDB({
      "/movie/7/watch/providers": { results: { SE: { flatrate: [provider(8, "Netflix")] } } },
      "/movie/7/release_dates": { results: [] },
    });

    expect((await getRegionalAvailability(7)).defaultRegion).toBe("SE");
  });

  it("keeps the certifications when the providers leg 404s", async () => {
    mockTMDB({ "/movie/7/release_dates": releaseDates });

    const { regions } = await getRegionalAvailability(7);
    expect(Object.keys(regions)).toEqual(["NO", "US"]);
    expect(regions.NO).toEqual({ providers: [], certification: "15", release_date: "2020-02-01" });
  });

  it("keeps the certifications when the providers leg is down", async () => {
    mockTMDB({ "/movie/7/watch/providers": 503, "/movie/7/release_dates": releaseDates });

    const { regions, defaultRegion } = await getRegionalAvailability(7);
    expect(Object.keys(regions)).toEqual(["NO", "US"]);
    expect(defaultRegion).toBe("NO");
  });

  it("rejects when both legs fail", async () => {
    mockTMDB({ "/movie/7/watch/providers": 503, "/movie/7/release_dates": 503 });

    await expect(getRegionalAvailability(7)).rejects.toMatchObject({ status: 503 });
  });

  // The 404 leg resolves to {}, so "every leg rejected" would call this "available nowhere".
  it("rejects when one leg 404s and the other is down", async () => {
    mockTMDB({ "/movie/7/release_dates": 503 });

    await expect(getRegionalAvailability(7)).rejects.toMatchObject({ status: 503 });
  });
});

describe("getRelatedFilms", () => {
  const film = (id: number, poster_path: string | null) => ({
    id,
    title: `Film ${id}`,
    poster_path,
    release_date: "2020-01-01",
    vote_average: 7,
    overview: "",
    popularity: 9,
  });

  it("prefers recommendations with posters", async () => {
    mockTMDB({
      "/movie/7/recommendations": { results: [film(1, "/1.jpg"), film(4, null)] },
      "/movie/7/similar": { results: [film(2, "/2.jpg")] },
    });

    const { films, source } = await getRelatedFilms(7);
    expect(films.map((f) => f.id)).toEqual([1]);
    expect(source).toBe("recommendations");
  });

  it("falls back to similar when no recommendation has a poster", async () => {
    mockTMDB({
      "/movie/7/recommendations": { results: [film(1, null)] },
      "/movie/7/similar": { results: [film(2, "/2.jpg"), film(3, null)] },
    });

    expect(await getRelatedFilms(7)).toEqual({
      films: [{ id: 2, title: "Film 2", poster_path: "/2.jpg", release_date: "2020-01-01", vote_average: 7, overview: "" }],
      source: "similar",
    });
  });

  it("keeps similar when recommendations are down", async () => {
    mockTMDB({ "/movie/7/recommendations": 503, "/movie/7/similar": { results: [film(2, "/2.jpg")] } });

    expect(await getRelatedFilms(7)).toMatchObject({ films: [{ id: 2 }], source: "similar" });
  });

  // Films without posters are left out, so they don't count as something to show.
  it("rejects when one leg fails and the other has no film with a poster", async () => {
    mockTMDB({ "/movie/7/recommendations": 503, "/movie/7/similar": { results: [film(2, null)] } });

    await expect(getRelatedFilms(7)).rejects.toMatchObject({ status: 503 });
  });
});

describe("getFilmDetail", () => {
  const crewMember = (id: number, job: string) => ({
    id,
    name: `Person ${id}`,
    job,
    department: "Crew",
    profile_path: null,
    credit_id: `${id}-${job}`,
  });

  it("keeps the six crew jobs, each person once per job", async () => {
    mockTMDB({
      "/movie/7": {
        id: 7,
        title: "Film 7",
        credits: {
          cast: [],
          crew: [
            crewMember(1, "Director"),
            crewMember(1, "Director"),
            crewMember(1, "Screenplay"),
            crewMember(2, "Gaffer"),
            crewMember(3, "Original Music Composer"),
          ],
        },
      },
    });

    const { credits } = await getFilmDetail(7);
    const projected = (id: number, job: string) => ({ id, name: `Person ${id}`, job, department: "Crew", profile_path: null });
    // toEqual, not a map of ids: TMDB's credit_id must not reach the page.
    expect(credits.crew).toEqual([
      projected(1, "Director"),
      projected(1, "Screenplay"),
      projected(3, "Original Music Composer"),
    ]);
  });

  it("rejects with TMDB's 404 when the film doesn't exist", async () => {
    mockTMDB({});

    const error = await getFilmDetail(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TMDBError);
    expect(error).toMatchObject({ status: 404 });
  });
});

describe("getFilmVideos", () => {
  const video = (id: string, type: string, published_at: string, site = "YouTube") => ({
    id,
    key: `k${id}`,
    name: id,
    site,
    type,
    official: true,
    published_at,
    iso_639_1: "en",
  });

  it("keeps YouTube only, trailers first, then newest", async () => {
    mockTMDB({
      "/movie/7/videos": {
        results: [
          video("clip", "Clip", "2020-03-01"),
          video("old-trailer", "Trailer", "2020-01-01"),
          video("vimeo", "Trailer", "2020-05-01", "Vimeo"),
          video("new-trailer", "Trailer", "2020-02-01"),
          video("bloopers", "Bloopers", "2020-04-01"),
        ],
      },
    });

    const videos = await getFilmVideos(7);
    expect(videos.map((v) => v.id)).toEqual(["new-trailer", "old-trailer", "clip", "bloopers"]);
    expect(videos[0]).not.toHaveProperty("iso_639_1");
  });
});

describe("getFilmReviews", () => {
  const review = (id: string, created_at: string, avatar_path: string | null) => ({
    id,
    author: id,
    author_details: { avatar_path, rating: null },
    content: "",
    created_at,
    url: `https://example.com/${id}`,
  });

  it("keeps the five newest and resolves both kinds of avatar path", async () => {
    mockTMDB({
      "/movie/7/reviews": {
        results: [
          review("a", "2020-01-01", null),
          review("b", "2020-01-06", "/https://gravatar.com/b.jpg"),
          review("c", "2020-01-05", "/c.jpg"),
          review("d", "2020-01-04", null),
          review("e", "2020-01-03", null),
          review("f", "2020-01-02", null),
        ],
      },
    });

    const reviews = await getFilmReviews(7);
    expect(reviews.map((r) => r.id)).toEqual(["b", "c", "d", "e", "f"]);
    expect(reviews[0].avatar_url).toBe("https://gravatar.com/b.jpg");
    expect(reviews[1].avatar_url).toBe("https://image.tmdb.org/t/p/w185/c.jpg");
  });
});
