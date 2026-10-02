import { matchedKeywords, reasonGenres } from "@/lib/whyLine";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";

describe("reasonGenres", () => {
  it("puts the mood's own genre first", () => {
    expect(reasonGenres([18, 35], ["laugh"])).toEqual(["Comedy", "Drama"]);
  });

  it("keeps the film's order for a mood with no genres", () => {
    expect(reasonGenres([18, 35, 80], ["nostalgic"])).toEqual(["Drama", "Comedy"]);
  });

  it("puts both moods' genres first in a blend, in the film's order", () => {
    expect(reasonGenres([18, 80, 35], ["laugh", "dark"])).toEqual(["Crime", "Comedy"]);
  });

  it("skips unknown ids", () => {
    expect(reasonGenres([424242, 35], ["laugh"])).toEqual(["Comedy"]);
  });

  it("holds max", () => {
    expect(reasonGenres([35, 18, 80], ["laugh"], 1)).toEqual(["Comedy"]);
    expect(reasonGenres([35, 18, 80], ["laugh"], 3)).toEqual(["Comedy", "Drama", "Crime"]);
  });

  it("doesn't throw on a prototype key", () => {
    expect(reasonGenres([18, 35], ["constructor"])).toEqual(["Drama", "Comedy"]);
  });
});

describe("matchedKeywords", () => {
  const feelgood = { id: TMDB_KEYWORDS.feelGood.id, name: "feelgood" };
  const heist = { id: TMDB_KEYWORDS.heist.id, name: "heist" };

  it("keeps only the mood's keywords, by TMDB's name", () => {
    expect(matchedKeywords([heist, feelgood], ["easy"])).toEqual(["feelgood"]);
  });

  it("returns nothing without overlap, or for a genre-only mood", () => {
    expect(matchedKeywords([heist], ["easy"])).toEqual([]);
    expect(matchedKeywords([feelgood], ["laugh"])).toEqual([]);
  });

  it("holds max", () => {
    const heartwarming = { id: TMDB_KEYWORDS.heartwarming.id, name: "heartwarming" };
    const friendship = { id: TMDB_KEYWORDS.friendship.id, name: "friendship" };
    expect(matchedKeywords([feelgood, heartwarming, friendship], ["easy"])).toEqual(["feelgood", "heartwarming"]);
  });

  it("doesn't throw on a prototype key", () => {
    expect(matchedKeywords([feelgood], ["constructor", "__proto__"])).toEqual([]);
  });
});
