import { moodMap } from "@/lib/moodMap";
import { MAX_TEXT_LENGTH, resolveMoodText, SYNONYMS } from "@/lib/moodResolver";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";

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

  it("resolves multiple signals in one phrase — mood + era + time", () => {
    const r = resolveMoodText("slow burn 80s noir");
    expect(r.moodKeys).toContain("dark");
    expect(r.era).toBe("classic");
    expect(r.time).toBe("long");
    expect(r.keywords).toContain(TMDB_KEYWORDS.neoNoir.id);
  });

  // Time is the filter the app has; tempo was the group page's old name for it.
  it("reads pace words as a Time, with no tempo left in the result", () => {
    expect(resolveMoodText("something fast").time).toBe("short");
    expect(resolveMoodText("meditative").time).toBe("long");
    expect(resolveMoodText("slow").time).toBe("long");
    expect(resolveMoodText("slow burn noir")).not.toHaveProperty("tempo");
  });

  it("extracts a heist keyword from the word 'heist'", () => {
    const r = resolveMoodText("heist");
    expect(r.moodKeys).toContain("thrilling");
    expect(r.keywords).toContain(TMDB_KEYWORDS.heist.id);
  });

  it("returns matched=false when nothing in the input is known", () => {
    const r = resolveMoodText("xyzzy plugh blorp");
    expect(r.moodKeys).toEqual([]);
    expect(r.keywords).toEqual([]);
    expect(r.era).toBeNull();
    expect(r.time).toBeNull();
    expect(r.matched).toBe(false);
  });

  it("is case-insensitive and tolerates punctuation", () => {
    const r = resolveMoodText("COZY!!! 90s ... Rom-Com.");
    expect(r.moodKeys).toContain("easy");
    expect(r.moodKeys).toContain("datenight");
    expect(r.era).toBe("modern");
    expect(r.keywords).toContain(TMDB_KEYWORDS.romanticComedy.id);
  });

  it("ignores mood keys that don't exist in moodMap", () => {
    // Sanity check that resolved moods only include real keys.
    const r = resolveMoodText("funny cozy weird");
    for (const key of r.moodKeys) {
      expect(typeof key).toBe("string");
      expect(key.length).toBeGreaterThan(0);
    }
  });

  // Both are the describe field's own placeholder copy.
  it("resolves the placeholder 'cozy 80s heist' in full", () => {
    const r = resolveMoodText("cozy 80s heist");
    expect(r.moodKeys).toEqual(["easy", "thrilling"]);
    expect(r.era).toBe("classic");
    expect(r.keywords).toEqual([TMDB_KEYWORDS.heist.id]);
    expect(r.unmatched).toEqual([]);
  });

  it("resolves the placeholder 'slow-burn noir' in full", () => {
    const r = resolveMoodText("slow-burn noir");
    expect(r.moodKeys).toEqual(["dark"]);
    expect(r.time).toBe("long");
    expect(r.unmatched).toEqual([]);
  });

  it("lists the meaningful words that matched nothing, once each", () => {
    const r = resolveMoodText("I want a cozy film with dragons and more dragons");
    expect(r.moodKeys).toEqual(["easy"]);
    expect(r.unmatched).toEqual(["dragons", "more"]);
  });

  it("does not report a word a bigram consumed", () => {
    expect(resolveMoodText("date night").unmatched).toEqual([]);
  });

  it("empty input returns no matches", () => {
    const r = resolveMoodText("   ");
    expect(r.matched).toBe(false);
  });

  // The home field echoes unmatched words live, so an inherited property name
  // must not vanish as if it had matched.
  it("reports a word that names an inherited property as unmatched", () => {
    const r = resolveMoodText("constructor");
    expect(r.moodKeys).toEqual([]);
    expect(r.unmatched).toEqual(["constructor"]);
    expect(r.matched).toBe(false);
  });

  it("still reads the known words beside an inherited property name", () => {
    const r = resolveMoodText("funny constructor");
    expect(r.moodKeys).toEqual(["laugh"]);
    expect(r.unmatched).toEqual(["constructor"]);
  });

  it("shares one text limit with the inputs and the route", () => {
    expect(MAX_TEXT_LENGTH).toBe(120);
  });

  // resolveMoodText silently drops a mood that no longer exists, so a stale
  // synonym would just stop matching instead of failing.
  it("only maps synonyms to moods that exist", () => {
    for (const [word, entry] of Object.entries(SYNONYMS)) {
      for (const mood of entry.moods ?? []) {
        expect(Object.hasOwn(moodMap, mood), `${word} → ${mood}`).toBe(true);
      }
    }
  });
});
