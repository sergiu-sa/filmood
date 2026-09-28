import {
  buildMoodParams,
  buildMergedMoodParams,
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

  it("caps family at US PG, and only family", () => {
    const family = buildMoodParams("family");
    expect(family.certification_country).toBe("US");
    expect(family["certification.lte"]).toBe("PG");
    for (const mood of allMoods.filter((m) => m.key !== "family")) {
      const params = buildMoodParams(mood.key);
      expect(params.certification_country, mood.key).toBeUndefined();
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

describe("buildMergedMoodParams", () => {
  it("unions keywords across merged moods with pipes", () => {
    const params = buildMergedMoodParams(["datenight", "dark"]);
    expect(params.with_keywords).toBe(
      [
        TMDB_KEYWORDS.romanticComedy.id,
        TMDB_KEYWORDS.neoNoir.id,
        TMDB_KEYWORDS.revenge.id,
        TMDB_KEYWORDS.corruption.id,
      ].join("|"),
    );
  });

  // nostalgic has no genres; its missing primary genre must not become "undefined".
  it("takes genres only from moods that have them", () => {
    expect(buildMergedMoodParams(["laugh", "nostalgic"]).with_genres).toBe("35");
    expect(buildMergedMoodParams(["nostalgic", "easy"]).with_genres).toBe("35");
  });

  it("keeps the family cap on any merge that includes family", () => {
    const params = buildMergedMoodParams(["laugh", "family"]);
    expect(params.certification_country).toBe("US");
    expect(params["certification.lte"]).toBe("PG");
    expect(buildMergedMoodParams(["laugh", "dark"]).certification_country).toBeUndefined();
  });

  it("ORs the target genres and keeps the runtime floor", () => {
    // laugh (35) and thrilling (28) share nothing, so each primary genre.
    const params = buildMergedMoodParams(["laugh", "thrilling"]);
    expect(params.with_genres).toBe("35|28");
    expect(params["with_runtime.gte"]).toBe(String(RUNTIME_FLOOR));
  });

  it("omits with_keywords when none of the merged moods define any", () => {
    const params = buildMergedMoodParams(["laugh", "thrilling"]);
    expect(params.with_keywords).toBeUndefined();
  });

  it("takes strictest quality thresholds across moods", () => {
    // mindbending voteAverageGte=7.0 vs dark voteAverageGte=6.8 → 7.0 wins
    const params = buildMergedMoodParams(["mindbending", "dark"]);
    expect(params["vote_average.gte"]).toBe("7");
  });

  it("delegates a single mood to buildMoodParams", () => {
    expect(buildMergedMoodParams(["dark"])).toEqual(buildMoodParams("dark"));
  });
});
