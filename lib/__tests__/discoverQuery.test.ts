import { discoverQuery } from "@/lib/discoverQuery";

const q = (query: string, device: string[] = []) => discoverQuery(new URLSearchParams(query), device);

describe("discoverQuery", () => {
  it("forwards every param the API reads, in a fixed order", () => {
    expect(
      q("seed=9&text=noir&runtime=long&tempo=slowburn&services=netflix&where=mine&era=classic&time=short&mood=laugh"),
    ).toBe("mood=laugh&time=short&era=classic&where=mine&services=netflix&tempo=slowburn&runtime=long&text=noir&seed=9");
  });

  it("drops src, the retired params and anything unknown", () => {
    expect(q("mood=laugh&seed=9&src=filter&language=en&exclude=27&utm_source=x")).toBe("mood=laugh&seed=9");
  });

  it("gives the same string for the same params in any order", () => {
    expect(q("seed=9&era=fresh&mood=laugh")).toBe(q("mood=laugh&era=fresh&seed=9"));
  });

  it("is null until the URL has a valid seed", () => {
    expect(q("mood=laugh")).toBeNull();
    expect(q("mood=laugh&seed=abc")).toBeNull();
    expect(q("mood=laugh&seed=0")).toBeNull();
  });

  it("is null without a mood or text", () => {
    expect(q("seed=9&era=fresh")).toBeNull();
    expect(q("text=noir&seed=9")).toBe("text=noir&seed=9");
  });

  // Q1: no Where means "my default", so this device's services go with it.
  it("adds this device's services with no Where or with My services", () => {
    expect(q("mood=laugh&seed=9", ["netflix", "viaplay"])).toBe("mood=laugh&services=netflix%2Cviaplay&seed=9");
    expect(q("mood=laugh&where=mine&seed=9", ["netflix"])).toBe("mood=laugh&where=mine&services=netflix&seed=9");
  });

  // The route reads an unknown Where as no Where.
  it("adds them with an unknown Where too", () => {
    expect(q("mood=laugh&where=elsewhere&seed=9", ["netflix"])).toBe(
      "mood=laugh&where=elsewhere&services=netflix&seed=9",
    );
  });

  it("never adds them to another Where or over the URL's own", () => {
    expect(q("mood=laugh&where=norway&seed=9", ["netflix"])).toBe("mood=laugh&where=norway&seed=9");
    expect(q("mood=laugh&where=any&seed=9", ["netflix"])).toBe("mood=laugh&where=any&seed=9");
    expect(q("mood=laugh&where=mine&services=viaplay&seed=9", ["netflix"])).toBe(
      "mood=laugh&where=mine&services=viaplay&seed=9",
    );
  });
});
