import { isPlatformName, parseServices, PLATFORMS, slugsFromNames } from "@/lib/platforms";

describe("PLATFORMS", () => {
  it("has unique slugs and names", () => {
    expect(new Set(PLATFORMS.map((p) => p.slug)).size).toBe(PLATFORMS.length);
    expect(new Set(PLATFORMS.map((p) => p.name)).size).toBe(PLATFORMS.length);
  });

  it("knows the stored display names", () => {
    expect(isPlatformName("Disney+")).toBe(true);
    expect(isPlatformName("Hulu")).toBe(false);
    expect(isPlatformName("netflix")).toBe(false);
  });
});

describe("parseServices", () => {
  it("reads comma-separated slugs", () => {
    expect(parseServices("netflix,viaplay")).toEqual(["netflix", "viaplay"]);
  });

  it("drops unknown slugs, empty entries and duplicates, and trims", () => {
    expect(parseServices("hulu,,netflix, netflix , viaplay,")).toEqual(["netflix", "viaplay"]);
    expect(parseServices(" netflix ")).toEqual(["netflix"]);
  });

  it.each([null, ""])("reads %j as none", (raw) => {
    expect(parseServices(raw)).toEqual([]);
  });

  // Same set, same TMDB query, same cache entry.
  it("returns slugs in PLATFORMS order, not input order", () => {
    expect(parseServices("viaplay,netflix")).toEqual(["netflix", "viaplay"]);
  });

  it("returns at most one of each platform", () => {
    const long = Array.from({ length: 20 }, (_, i) => PLATFORMS[i % PLATFORMS.length].slug).join(",");
    expect(parseServices(long)).toHaveLength(PLATFORMS.length);
  });

  it.each(["constructor", "__proto__", "toString"])("rejects the inherited key %s", (raw) => {
    expect(parseServices(raw)).toEqual([]);
  });
});

describe("slugsFromNames", () => {
  it("maps stored names to slugs and drops unknown ones", () => {
    expect(slugsFromNames(["Netflix", "Disney+", "Bogus"])).toEqual(["netflix", "disney-plus"]);
  });

  it("returns slugs in PLATFORMS order", () => {
    expect(slugsFromNames(["Prime Video", "Netflix"])).toEqual(["netflix", "prime-video"]);
  });
});
