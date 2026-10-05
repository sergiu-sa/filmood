import {
  allMoods,
  LEGACY_MOOD_ALIASES,
  moodMap,
  normalizeMoodKey,
  normalizeMoodKeys,
} from "@/lib/moodMap";

describe("moodMap data integrity", () => {
  it("defines the 12 moods of mood list v2", () => {
    expect(allMoods.length).toBe(12);
    expect(Object.keys(moodMap).sort()).toEqual(
      [
        "laugh", "easy", "family", "datenight", "cry", "nostalgic",
        "inspiring", "thrilling", "unsettled", "dark", "mindbending", "escape",
      ].sort(),
    );
  });

  it("every mood has required fields", () => {
    for (const mood of allMoods) {
      expect(mood.key).toBeTruthy();
      expect(mood.tagLabel).toBeTruthy();
      expect(mood.description).toBeTruthy();
      expect(mood.voteCountGte).toBeGreaterThan(0);
      expect(["popularity.desc", "vote_average.desc"]).toContain(mood.sortBy);
      expect(["gold", "blue", "rose", "violet", "teal", "ember"]).toContain(mood.accentColor);
    }
  });

  it("every mood's essential side is non-empty", () => {
    for (const mood of allMoods) {
      const side = mood.essential === "genres" ? mood.genres : mood.keywords;
      expect(side?.length, mood.key).toBeGreaterThan(0);
    }
  });

  // Keeps the tile grid even: six accents, twelve moods.
  it("uses each accent for exactly two moods", () => {
    const counts = new Map<string, number>();
    for (const mood of allMoods) {
      counts.set(mood.accentColor, (counts.get(mood.accentColor) ?? 0) + 1);
    }
    expect([...counts.values()]).toEqual([2, 2, 2, 2, 2, 2]);
  });

  it("every mood lists 3 existing related moods, never itself", () => {
    for (const mood of allMoods) {
      expect(mood.relatedMoods, mood.key).toHaveLength(3);
      expect(new Set(mood.relatedMoods).size).toBe(3);
      for (const key of mood.relatedMoods) {
        expect(Object.hasOwn(moodMap, key), `${mood.key} → ${key}`).toBe(true);
        expect(key).not.toBe(mood.key);
      }
    }
  });

  it("every mood key is unique", () => {
    const keys = allMoods.map((m) => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("LEGACY_MOOD_ALIASES", () => {
  it("points every retired key at an existing mood", () => {
    for (const [retired, target] of Object.entries(LEGACY_MOOD_ALIASES)) {
      expect(Object.hasOwn(moodMap, target), `${retired} → ${target}`).toBe(true);
      expect(Object.hasOwn(moodMap, retired), retired).toBe(false);
    }
  });
});

describe("normalizeMoodKey", () => {
  it("keeps a current key", () => {
    expect(normalizeMoodKey("laugh")).toBe("laugh");
  });

  it.each([
    ["beautiful", "cry"],
    ["thoughtful", "mindbending"],
    ["weird", "mindbending"],
  ])("maps the retired key %s to %s", (retired, target) => {
    expect(normalizeMoodKey(retired)).toBe(target);
  });

  it("ignores case and surrounding whitespace", () => {
    expect(normalizeMoodKey("  Dark ")).toBe("dark");
    expect(normalizeMoodKey("BEAUTIFUL")).toBe("cry");
  });

  it.each(["", "nonexistent", "constructor", "__proto__", "toString"])(
    "returns null for %j",
    (key) => {
      expect(normalizeMoodKey(key)).toBeNull();
    },
  );
});

describe("normalizeMoodKeys", () => {
  it("normalises, drops unknowns and dedupes in order", () => {
    expect(
      normalizeMoodKeys(["weird", "cry", "bogus", "beautiful", "thoughtful", "laugh"]),
    ).toEqual(["mindbending", "cry", "laugh"]);
  });
});
