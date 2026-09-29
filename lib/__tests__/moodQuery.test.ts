import {
  buildMoodParams,
  paramsForConfig,
  RUNTIME_FLOOR,
} from "@/lib/moodQuery";
import { allMoods, moodMap } from "@/lib/moodMap";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";
import type { MoodConfig } from "@/lib/types";

describe("buildMoodParams", () => {
  it("returns correct params for 'laugh' mood", () => {
    const params = buildMoodParams("laugh");
    expect(params.with_genres).toBe("35");
    expect(params.sort_by).toBe("popularity.desc");
    expect(params["vote_count.gte"]).toBe("500");
    expect(params.without_genres).toBe("27,16");
    expect(params.watch_region).toBe("NO");
    expect(params.with_watch_monetization_types).toBe("flatrate");
  });

  // TMDB reads "," as AND, so a comma here asked for Fantasy AND Adventure AND Sci-Fi.
  it("ORs a mood's genres with a pipe", () => {
    const params = buildMoodParams("escape");
    expect(params.with_genres).toBe("14|12|878");
    expect(params["vote_average.gte"]).toBe("7");
  });

  it("ORs a mood's keywords with a pipe", () => {
    expect(buildMoodParams("cry").with_keywords).toBe(
      [
        TMDB_KEYWORDS.tearjerker.id,
        TMDB_KEYWORDS.grief.id,
        TMDB_KEYWORDS.lossOfLovedOne.id,
      ].join("|"),
    );
  });

  // An empty with_genres is not "any genre" to every reader of the params.
  it("omits with_genres for a mood defined by keywords alone", () => {
    const params = buildMoodParams("nostalgic");
    expect(params.with_genres).toBeUndefined();
    expect(params.with_keywords).toBeDefined();
  });

  // The lower bound matters: TMDB ranks US "NR" below G, so lte=PG alone
  // admits every unrated film.
  it("caps family at US G–PG, and only family", () => {
    expect(buildMoodParams("family")).toMatchObject({
      certification_country: "US",
      "certification.gte": "G",
      "certification.lte": "PG",
    });
    for (const mood of allMoods.filter((m) => m.key !== "family")) {
      const params = buildMoodParams(mood.key);
      expect(params.certification_country, mood.key).toBeUndefined();
      expect(params["certification.gte"], mood.key).toBeUndefined();
      expect(params["certification.lte"], mood.key).toBeUndefined();
    }
  });

  // Regression guard: two moods once sent byte-identical queries.
  it("gives every mood a distinct query", () => {
    const queries = allMoods.map((m) => JSON.stringify(buildMoodParams(m.key)));
    expect(new Set(queries).size).toBe(allMoods.length);
  });

  it("keeps exclusions comma-joined", () => {
    expect(buildMoodParams("datenight").without_genres).toBe("27,10752");
  });

  it("ANDs genres with a comma when the mood asks for all of them", () => {
    const fixture: MoodConfig = {
      ...moodMap.laugh,
      genres: [35, 18],
      genreMatch: "all",
    };
    expect(paramsForConfig(fixture).with_genres).toBe("35,18");
    expect(paramsForConfig({ ...fixture, genreMatch: "any" }).with_genres).toBe("35|18");
  });

  it("throws on unknown mood key", () => {
    expect(() => buildMoodParams("nonexistent")).toThrow("Unknown mood: nonexistent");
  });

  // `in` and bracket lookup both see Object.prototype, so these pass a naive guard.
  it.each(["constructor", "__proto__", "toString"])(
    "rejects the inherited key %s as unknown",
    (key) => {
      expect(() => buildMoodParams(key)).toThrow(`Unknown mood: ${key}`);
    },
  );

  it("always sets the runtime floor, watch region and monetization type", () => {
    for (const mood of allMoods) {
      const params = buildMoodParams(mood.key);
      expect(params["with_runtime.gte"]).toBe(String(RUNTIME_FLOOR));
      expect(params.watch_region).toBe("NO");
      expect(params.with_watch_monetization_types).toBe("flatrate");
    }
  });

  it("only includes vote_average.gte when mood has voteAverageGte", () => {
    for (const mood of allMoods) {
      const params = buildMoodParams(mood.key);
      if (mood.voteAverageGte) {
        expect(params["vote_average.gte"]).toBe(mood.voteAverageGte.toString());
      } else {
        expect(params["vote_average.gte"]).toBeUndefined();
      }
    }
  });

  it("only includes without_genres when mood has excludeGenres", () => {
    for (const mood of allMoods) {
      const params = buildMoodParams(mood.key);
      if (mood.excludeGenres) {
        expect(params.without_genres).toBe(mood.excludeGenres.join(","));
      } else {
        expect(params.without_genres).toBeUndefined();
      }
    }
  });

  it("only includes with_keywords when the mood defines keywords", () => {
    for (const mood of allMoods) {
      const params = buildMoodParams(mood.key);
      if (mood.keywords && mood.keywords.length > 0) {
        expect(params.with_keywords).toBe(mood.keywords.join("|"));
      } else {
        expect(params.with_keywords).toBeUndefined();
      }
    }
  });
});

describe("buildMoodParams tiers", () => {
  // dark is genre-essential: tier 1 drops its keywords.
  it("steps a genre-essential mood down by dropping keywords, then easing floors", () => {
    const tier0 = buildMoodParams("dark", 0);
    const { with_keywords, ...withoutKeywords } = tier0;
    expect(with_keywords).toBeDefined();

    expect(buildMoodParams("dark", 1)).toEqual(withoutKeywords);
    expect(buildMoodParams("dark", 2)).toEqual({
      ...withoutKeywords,
      "vote_count.gte": "150",
      "vote_average.gte": "6.3",
    });
  });

  // mindbending is keyword-essential: tier 1 drops its genres.
  it("steps a keyword-essential mood down by dropping genres, then easing floors", () => {
    const tier0 = buildMoodParams("mindbending", 0);
    const { with_genres, ...withoutGenres } = tier0;
    expect(with_genres).toBeDefined();

    expect(buildMoodParams("mindbending", 1)).toEqual(withoutGenres);
    expect(buildMoodParams("mindbending", 2)).toEqual({
      ...withoutGenres,
      "vote_count.gte": "150",
      "vote_average.gte": "6.5",
    });
  });

  it("leaves tier 1 equal to tier 0 when the non-essential side is empty", () => {
    expect(buildMoodParams("laugh", 1)).toEqual(buildMoodParams("laugh", 0));
    expect(buildMoodParams("nostalgic", 1)).toEqual(buildMoodParams("nostalgic", 0));
  });

  it("defaults to tier 0", () => {
    expect(buildMoodParams("cry")).toEqual(buildMoodParams("cry", 0));
  });

  // A safety cap, not a taste constraint: the ladder never loosens it.
  it.each([0, 1, 2] as const)("keeps the family cap at tier %i", (tier) => {
    expect(buildMoodParams("family", tier)).toMatchObject({
      certification_country: "US",
      "certification.gte": "G",
      "certification.lte": "PG",
    });
  });

  it.each([0, 1, 2] as const)("keeps the runtime floor and exclusions at tier %i", (tier) => {
    for (const mood of allMoods) {
      const params = buildMoodParams(mood.key, tier);
      expect(params["with_runtime.gte"], mood.key).toBe(String(RUNTIME_FLOOR));
      expect(params.without_genres, mood.key).toBe(mood.excludeGenres?.join(","));
    }
  });

  it("never eases the vote count below 1", () => {
    const fixture: MoodConfig = { ...moodMap.laugh, voteCountGte: 1 };
    expect(paramsForConfig(fixture, 2)["vote_count.gte"]).toBe("1");
  });
});
