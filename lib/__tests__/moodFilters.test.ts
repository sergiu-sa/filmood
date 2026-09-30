import {
  activeFilterKeys,
  applyFilters,
  clearFilterParam,
  parseFilters,
  removableFilterKeys,
  setFilterParam,
  withoutFilter,
  ANY_LABELS,
  EMPTY_FILTERS,
  ERA_OPTIONS,
  TIME_OPTIONS,
  WHERE_OPTIONS,
  type Filters,
} from "@/lib/moodFilters";
import { resolveMoodText } from "@/lib/moodResolver";
import { buildMoodParams, RUNTIME_FLOOR } from "@/lib/moodQuery";

const sp = (query: string) => new URLSearchParams(query);
const filters = (f: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...f });

describe("parseFilters", () => {
  it("defaults to no Time, no Era and Norway streaming", () => {
    expect(parseFilters(sp(""), null)).toEqual(EMPTY_FILTERS);
    expect(EMPTY_FILTERS).toMatchObject({ time: null, era: null, where: "norway" });
  });

  it("reads each allowed value", () => {
    expect(parseFilters(sp("time=medium&era=modern&where=any"), null)).toMatchObject({
      time: "medium",
      era: "modern",
      where: "any",
    });
  });

  // Only resolveWhere knows the provider ids; the URL can't set them.
  it("reads My services without providers", () => {
    expect(parseFilters(sp("where=mine&services=netflix&with_watch_providers=8"), null)).toEqual({
      ...EMPTY_FILTERS,
      where: "mine",
      providers: [],
    });
  });

  it("falls back to the defaults for values it doesn't know", () => {
    expect(parseFilters(sp("time=forever&era=future&where=moon"), null)).toEqual(EMPTY_FILTERS);
    // hasOwn-style lookups: inherited keys are client input, not values.
    expect(parseFilters(sp("time=constructor&tempo=__proto__&runtime=toString"), null)).toEqual(
      EMPTY_FILTERS,
    );
  });

  // Old shared links (spec §8).
  it.each([
    ["runtime=short", "short"],
    ["runtime=long", "long"],
    ["tempo=fastpaced", "short"],
    ["tempo=slowburn", "long"],
  ])("maps the legacy %s to time=%s", (query, time) => {
    expect(parseFilters(sp(query), null).time).toBe(time);
  });

  it("prefers time over tempo, and tempo over runtime", () => {
    expect(parseFilters(sp("time=medium&tempo=slowburn&runtime=short"), null).time).toBe("medium");
    expect(parseFilters(sp("tempo=fastpaced&runtime=long"), null).time).toBe("short");
  });

  it("ignores the retired language and exclude params", () => {
    expect(parseFilters(sp("language=en&exclude=27"), null)).toEqual(EMPTY_FILTERS);
  });

  it("lets explicit params beat the text, and falls back to the text without them", () => {
    const resolved = resolveMoodText("slow burn 80s noir");
    expect(parseFilters(sp("time=short&era=fresh"), resolved)).toMatchObject({
      time: "short",
      era: "fresh",
    });
    expect(parseFilters(sp(""), resolved)).toMatchObject({
      time: "long",
      era: "classic",
      extraKeywords: resolved.keywords,
    });
  });
});

describe("applyFilters", () => {
  it("bounds each Time bucket", () => {
    const at = (time: Filters["time"]) => {
      const p = buildMoodParams("laugh");
      applyFilters(p, filters({ time }));
      return [p["with_runtime.gte"], p["with_runtime.lte"]];
    };
    expect(at("short")).toEqual([String(RUNTIME_FLOOR), "100"]);
    expect(at("medium")).toEqual([String(RUNTIME_FLOOR), "120"]);
    expect(at("long")).toEqual(["140", undefined]);
  });

  it("bounds each era window", () => {
    const at = (era: Filters["era"]) => {
      const p: Record<string, string> = {};
      applyFilters(p, filters({ era, where: "any" }));
      return p;
    };
    expect(at("classic")).toEqual({ "primary_release_date.lte": "1989-12-31" });
    expect(at("modern")).toEqual({
      "primary_release_date.gte": "1990-01-01",
      "primary_release_date.lte": "2009-12-31",
    });
    expect(at("fresh")).toEqual({ "primary_release_date.gte": "2010-01-01" });
  });

  it("limits Norway to Norwegian subscription streaming and Anywhere to nothing", () => {
    const norway: Record<string, string> = {};
    applyFilters(norway, EMPTY_FILTERS);
    expect(norway).toEqual({ watch_region: "NO", with_watch_monetization_types: "flatrate" });

    const any: Record<string, string> = { with_genres: "35" };
    applyFilters(any, filters({ where: "any" }));
    expect(any).toEqual({ with_genres: "35" });
  });

  // TMDB reads "," as AND here too, which would demand a film be on every service.
  it("ORs My services' providers inside Norwegian subscription streaming", () => {
    const p: Record<string, string> = {};
    applyFilters(p, filters({ where: "mine", providers: [8, 76] }));
    expect(p).toEqual({
      watch_region: "NO",
      with_watch_monetization_types: "flatrate",
      with_watch_providers: "8|76",
    });
  });

  // TMDB reads "," as AND: a comma here would demand the text's keywords
  // *and* the mood's, instead of widening to either.
  it("ORs the text's keywords with the mood's and dedupes", () => {
    const p: Record<string, string> = { with_keywords: "6054|180" };
    applyFilters(p, filters({ where: "any", extraKeywords: [180, 9999] }));
    expect(p.with_keywords).toBe("6054|180|9999");

    const none: Record<string, string> = {};
    applyFilters(none, filters({ where: "any", extraKeywords: [1, 2] }));
    expect(none.with_keywords).toBe("1|2");
  });

  it("never adds a language or genre filter", () => {
    const p = buildMoodParams("datenight");
    applyFilters(p, parseFilters(sp("language=scand&exclude=10749"), null));
    expect(p.with_original_language).toBeUndefined();
    expect(p.without_genres).toBe(buildMoodParams("datenight").without_genres);
  });

  // One Time value means one runtime bound: the old tempo × runtime collision
  // can't be expressed, and nothing lowers or deletes the mood's floor.
  it("keeps one consistent runtime bound under every Time × legacy combination", () => {
    for (const time of [null, ...TIME_OPTIONS.map((o) => o.value)]) {
      for (const tempo of [null, "slowburn", "fastpaced"]) {
        for (const runtime of [null, "short", "long"]) {
          const query = new URLSearchParams();
          if (time) query.set("time", time);
          if (tempo) query.set("tempo", tempo);
          if (runtime) query.set("runtime", runtime);

          const p = buildMoodParams("laugh");
          applyFilters(p, parseFilters(query, null));
          const gte = Number(p["with_runtime.gte"]);
          expect(gte).toBeGreaterThanOrEqual(RUNTIME_FLOOR);
          if (p["with_runtime.lte"]) expect(Number(p["with_runtime.lte"])).toBeGreaterThan(gte);
        }
      }
    }
  });
});

describe("activeFilterKeys", () => {
  // Norway is a filter the user can loosen to Anywhere, so the default counts.
  it("counts the default Where and nothing else", () => {
    expect(activeFilterKeys(EMPTY_FILTERS)).toEqual(["where"]);
    expect(activeFilterKeys(filters({ where: "any" }))).toEqual([]);
  });

  it("lists every set filter but never the text's keywords", () => {
    expect(activeFilterKeys(filters({ time: "long", era: "classic", extraKeywords: [1] }))).toEqual([
      "time",
      "era",
      "where",
    ]);
    expect(activeFilterKeys(filters({ where: "any", extraKeywords: [1] }))).toEqual([]);
  });
});

describe("withoutFilter", () => {
  it("clears Time and Era, and loosens Where to Anywhere", () => {
    const f = filters({ time: "short", era: "classic", extraKeywords: [9] });
    expect(withoutFilter(f, "time")).toEqual({ ...f, time: null });
    expect(withoutFilter(f, "era")).toEqual({ ...f, era: null });
    expect(withoutFilter(f, "where")).toEqual({ ...f, where: "any" });
    expect(f.time).toBe("short");
  });

  // A Time or Era probe on My services still searches the user's services.
  it("keeps My services' providers when Time or Era goes", () => {
    const f = filters({ where: "mine", providers: [8], time: "short", era: "classic" });
    expect(withoutFilter(f, "time").providers).toEqual([8]);
    expect(withoutFilter(f, "era").providers).toEqual([8]);
  });

  it("drops My services' providers with Where", () => {
    const f = filters({ where: "mine", providers: [8] });
    expect(withoutFilter(f, "where")).toEqual({ ...f, where: "any", providers: [] });
  });
});

describe("clearFilterParam", () => {
  it("deletes Time with every legacy param that sets it", () => {
    const before = sp("mood=laugh&time=short&tempo=slowburn&runtime=long&seed=9");
    const after = clearFilterParam(before, "time");
    expect(after.toString()).toBe("mood=laugh&seed=9");
    expect(before.get("tempo")).toBe("slowburn");
  });

  it("deletes Era", () => {
    expect(clearFilterParam(sp("mood=laugh&era=fresh&seed=9"), "era").toString()).toBe(
      "mood=laugh&seed=9",
    );
  });

  // Norway is the default, so deleting the param would change nothing.
  it("sets Where to Anywhere", () => {
    expect(clearFilterParam(sp("mood=laugh&seed=9"), "where").get("where")).toBe("any");
    expect(clearFilterParam(sp("mood=laugh&where=norway"), "where").get("where")).toBe("any");
  });

  it("drops the services with My services", () => {
    expect(clearFilterParam(sp("mood=laugh&where=mine&services=netflix&seed=9"), "where").toString()).toBe(
      "mood=laugh&seed=9&where=any",
    );
  });
});

describe("setFilterParam", () => {
  it("replaces Time and every legacy param that set it", () => {
    const before = sp("mood=laugh&tempo=slowburn&runtime=long&seed=9");
    expect(setFilterParam(before, "time", "short").toString()).toBe("mood=laugh&seed=9&time=short");
    expect(before.toString()).toBe("mood=laugh&tempo=slowburn&runtime=long&seed=9");
  });

  it("clears Time and Era with null", () => {
    expect(setFilterParam(sp("mood=laugh&tempo=fastpaced&seed=9"), "time", null).toString()).toBe(
      "mood=laugh&seed=9",
    );
    expect(setFilterParam(sp("mood=laugh&era=classic&seed=9"), "era", null).toString()).toBe(
      "mood=laugh&seed=9",
    );
  });

  it("drops the services when Where leaves My services", () => {
    expect(setFilterParam(sp("mood=laugh&where=mine&services=netflix&seed=9"), "where", "norway").toString()).toBe(
      "mood=laugh&seed=9&where=norway",
    );
  });
});

describe("labels", () => {
  it("gives every option a short label", () => {
    for (const o of [...TIME_OPTIONS, ...ERA_OPTIONS, ...WHERE_OPTIONS]) expect(o.short).toMatch(/\S/);
  });

  it("names every filter when it's off", () => {
    expect(Object.keys(ANY_LABELS).sort()).toEqual(["era", "time", "where"]);
  });
});

// A suggestion's button applies clearFilterParam, so only filters that it
// actually loosens are worth offering.
describe("removableFilterKeys", () => {
  it("offers every filter set in the URL, plus the default Where", () => {
    expect(removableFilterKeys(sp("era=classic&time=short"), null)).toEqual(["time", "era", "where"]);
  });

  it("offers Time for a legacy tempo link", () => {
    expect(removableFilterKeys(sp("tempo=slowburn&where=any"), null)).toEqual(["time"]);
  });

  it("skips values the text implied, since there's no param to clear", () => {
    const resolved = resolveMoodText("slow burn 80s noir");
    expect(parseFilters(sp("where=any"), resolved)).toMatchObject({ time: "long", era: "classic" });
    expect(removableFilterKeys(sp("where=any"), resolved)).toEqual([]);
  });

  it("skips a URL Time the text would bring back", () => {
    const resolved = resolveMoodText("slow burn");
    expect(removableFilterKeys(sp("time=short&where=any"), resolved)).toEqual([]);
  });

  it("offers Anywhere for My services", () => {
    expect(removableFilterKeys(sp("where=mine&services=netflix"), null)).toEqual(["where"]);
  });

  it("doesn't offer Anywhere when it's already Anywhere", () => {
    expect(removableFilterKeys(sp("where=any"), null)).toEqual([]);
  });

  it("ignores params that don't apply", () => {
    expect(removableFilterKeys(sp("time=forever&language=en&exclude=27&where=any"), null)).toEqual([]);
  });
});
