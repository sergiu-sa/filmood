import { buildTMDBParams, buildMergedTMDBParams, allMoods, moodMap } from "@/lib/moodMap";

describe("buildTMDBParams", () => {
  it("returns correct params for 'laugh' mood", () => {
    const params = buildTMDBParams("laugh");
    expect(params.with_genres).toBe("35");
    expect(params.sort_by).toBe("popularity.desc");
    expect(params["vote_count.gte"]).toBe("500");
    expect(params.without_genres).toBe("27");
    expect(params.watch_region).toBe("NO");
    expect(params.with_watch_monetization_types).toBe("flatrate");
  });

  it("returns correct params for 'beautiful' mood (has voteAverageGte)", () => {
    const params = buildTMDBParams("beautiful");
    expect(params.with_genres).toBe("18,10749");
    expect(params.sort_by).toBe("vote_average.desc");
    expect(params["vote_average.gte"]).toBe("7");
    expect(params.without_genres).toBeUndefined();
  });

  it("returns correct params for 'thrilling' mood (has excludeGenres)", () => {
    const params = buildTMDBParams("thrilling");
    expect(params.with_genres).toBe("28,53");
    expect(params.without_genres).toBe("35");
  });

  it("throws on unknown mood key", () => {
    expect(() => buildTMDBParams("nonexistent")).toThrow("Unknown mood: nonexistent");
  });

  it("always includes watch_region and monetization type", () => {
    for (const mood of allMoods) {
      const params = buildTMDBParams(mood.key);
      expect(params.watch_region).toBe("NO");
      expect(params.with_watch_monetization_types).toBe("flatrate");
    }
  });

  it("only includes vote_average.gte when mood has voteAverageGte", () => {
    for (const mood of allMoods) {
      const params = buildTMDBParams(mood.key);
      if (mood.voteAverageGte) {
        expect(params["vote_average.gte"]).toBe(mood.voteAverageGte.toString());
      } else {
        expect(params["vote_average.gte"]).toBeUndefined();
      }
    }
  });

  it("only includes without_genres when mood has excludeGenres", () => {
    for (const mood of allMoods) {
      const params = buildTMDBParams(mood.key);
      if (mood.excludeGenres) {
        expect(params.without_genres).toBe(mood.excludeGenres.join(","));
      } else {
        expect(params.without_genres).toBeUndefined();
      }
    }
  });

  it("includes with_keywords when the mood defines keywords", () => {
    for (const mood of allMoods) {
      const params = buildTMDBParams(mood.key);
      if (mood.keywords && mood.keywords.length > 0) {
        expect(params.with_keywords).toBe(mood.keywords.join(","));
      } else {
        expect(params.with_keywords).toBeUndefined();
      }
    }
  });
});

describe("buildMergedTMDBParams", () => {
  it("unions keywords across merged moods", () => {
    // datenight (6054,9799) + nostalgic (180547) should union all three.
    const params = buildMergedTMDBParams(["datenight", "nostalgic"]);
    expect(params.with_keywords).toBeDefined();
    const actual = new Set(params.with_keywords!.split(","));
    expect(actual).toEqual(new Set(["6054", "9799", "180547"]));
  });

  it("omits with_keywords when none of the merged moods define any", () => {
    // beautiful + cry have no keywords
    const params = buildMergedTMDBParams(["beautiful", "cry"]);
    expect(params.with_keywords).toBeUndefined();
  });

  it("takes strictest quality thresholds across moods", () => {
    // mindbending voteAverageGte=7.0 vs dark voteAverageGte=6.8 → 7.0 wins
    const params = buildMergedTMDBParams(["mindbending", "dark"]);
    expect(params["vote_average.gte"]).toBe("7");
  });
});

describe("moodMap data integrity", () => {
  it("has 15 moods defined", () => {
    expect(allMoods.length).toBe(15);
  });

  it("includes the 5 new moods added in Stage 3", () => {
    for (const key of ["datenight", "nostalgic", "mindbending", "dark", "weird"]) {
      expect(moodMap[key]).toBeDefined();
    }
  });

  it("every mood has required fields", () => {
    for (const mood of allMoods) {
      expect(mood.key).toBeTruthy();
      expect(mood.label).toBeTruthy();
      expect(mood.description).toBeTruthy();
      expect(mood.genres.length).toBeGreaterThan(0);
      expect(mood.voteCountGte).toBeGreaterThan(0);
      expect(["popularity.desc", "vote_average.desc"]).toContain(mood.sortBy);
      expect(["gold", "blue", "rose", "violet", "teal", "ember"]).toContain(mood.accentColor);
    }
  });

  it("every mood key is unique", () => {
    const keys = allMoods.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
