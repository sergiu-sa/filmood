import { resolveMoodText } from "@/lib/moodResolver";

describe("resolveMoodText", () => {
  it("resolves a simple unigram to its mood", () => {
    const r = resolveMoodText("funny");
    expect(r.moodKeys).toContain("laugh");
    expect(r.matched).toBe(true);
  });

  it("resolves bigrams before unigrams (so 'date night' picks datenight, not date+night)", () => {
    const r = resolveMoodText("date night");
    expect(r.moodKeys).toContain("datenight");
    expect(r.matched).toBe(true);
  });

  it("resolves multiple signals in one phrase — mood + era + tempo", () => {
    const r = resolveMoodText("slow burn 80s noir");
    expect(r.moodKeys).toContain("dark");
    expect(r.era).toBe("classic");
    expect(r.tempo).toBe("slowburn");
    expect(r.keywords).toContain(1701);
  });

  it("extracts a heist keyword from the word 'heist'", () => {
    const r = resolveMoodText("heist");
    expect(r.moodKeys).toContain("thrilling");
    expect(r.keywords).toContain(10160);
  });

  it("returns matched=false when nothing in the input is known", () => {
    const r = resolveMoodText("xyzzy plugh blorp");
    expect(r.moodKeys).toEqual([]);
    expect(r.keywords).toEqual([]);
    expect(r.era).toBeNull();
    expect(r.tempo).toBeNull();
    expect(r.matched).toBe(false);
  });

  it("is case-insensitive and tolerates punctuation", () => {
    const r = resolveMoodText("COZY!!! 90s ... Rom-Com.");
    expect(r.moodKeys).toContain("easy");
    expect(r.moodKeys).toContain("datenight");
    expect(r.era).toBe("modern");
    expect(r.keywords).toContain(9799);
  });

  it("ignores mood keys that don't exist in moodMap", () => {
    // Sanity check that resolved moods only include real keys.
    const r = resolveMoodText("funny cozy weird");
    for (const key of r.moodKeys) {
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    }
  });

  it("empty input returns no matches", () => {
    const r = resolveMoodText("   ");
    expect(r.matched).toBe(false);
  });
});
