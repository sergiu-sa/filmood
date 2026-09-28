import { allMoods, moodMap } from "@/lib/moodMap";

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
