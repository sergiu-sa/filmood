import {
  getFilmDetail,
  getRegionalAvailability,
  getRelatedFilms,
} from "@/lib/filmData";
import { TMDBError } from "@/lib/tmdb-fetch";

/** Answers each TMDB path with its body, or with the status when it's a number. Unlisted paths 404. */
function mockTMDB(answers: Record<string, unknown>) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname.replace(/^\/3/, "");
      const answer = path in answers ? answers[path] : 404;
      const status = typeof answer === "number" ? answer : 200;
      return { ok: status === 200, status, json: async () => answer };
    }),
  );
}

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

  it("rejects when both legs fail", async () => {
    mockTMDB({ "/movie/7/watch/providers": 503, "/movie/7/release_dates": 503 });

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
    expect(credits.crew.map((m) => `${m.id}:${m.job}`)).toEqual([
      "1:Director",
      "1:Screenplay",
      "3:Original Music Composer",
    ]);
  });

  it("rejects with TMDB's 404 when the film doesn't exist", async () => {
    mockTMDB({});

    const error = await getFilmDetail(7).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TMDBError);
    expect(error).toMatchObject({ status: 404 });
  });
});
