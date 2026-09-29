import {
  activeRefinementKeys,
  applyRefinements,
  parseRefinements,
  withoutRefinement,
  EMPTY_REFINEMENTS,
} from "@/lib/moodFilters";
import { resolveMoodText } from "@/lib/moodResolver";
import { buildMoodParams, RUNTIME_FLOOR } from "@/lib/moodQuery";

const sp = (query: string) => new URLSearchParams(query);

describe("parseRefinements", () => {
  it("returns empty refinements for an empty query", () => {
    expect(parseRefinements(sp(""), null)).toEqual(EMPTY_REFINEMENTS);
  });

  it("accepts a comma-separated genre id list for exclude", () => {
    expect(parseRefinements(sp("exclude=27"), null).exclude).toBe("27");
    expect(parseRefinements(sp("exclude=27,99"), null).exclude).toBe("27,99");
  });

  // A free-form id list would make every request a cache miss on TMDB.
  it("keeps only the genres the panel offers, deduped in one order", () => {
    expect(parseRefinements(sp("exclude=27,12345"), null).exclude).toBe("27");
    expect(parseRefinements(sp("exclude=99,27,27"), null).exclude).toBe("27,99");
    expect(parseRefinements(sp("exclude=12345,678"), null).exclude).toBeNull();
  });

  // Anything else would earn a 400 from TMDB and surface as our 500.
  it.each(["27,", ",27", "27;99", "abc", "27|99", "27, 99"])(
    "drops a malformed exclude %j",
    (raw) => {
      expect(
        parseRefinements(sp(`exclude=${encodeURIComponent(raw)}`), null).exclude,
      ).toBeNull();
    },
  );

  it("prefers explicit era/tempo over values resolved from text", () => {
    const resolved = resolveMoodText("80s slow burn");
    const r = parseRefinements(sp("era=fresh&tempo=fastpaced"), resolved);
    expect(r.era).toBe("fresh");
    expect(r.tempo).toBe("fastpaced");
  });

  it("falls back to text-resolved era/tempo/keywords", () => {
    const resolved = resolveMoodText("80s slow burn heist");
    const r = parseRefinements(sp(""), resolved);
    expect(r.era).toBe("classic");
    expect(r.tempo).toBe("slowburn");
    expect(r.extraKeywords).toEqual(resolved.keywords);
  });

  // applyRefinements ignores anything else, so a stray value must not count as
  // an active filter (suggestion probes) or reach search_events as raw text.
  it("keeps only runtime and language values that apply", () => {
    expect(parseRefinements(sp("runtime=short&language=scand"), null)).toMatchObject({
      runtime: "short",
      language: "scand",
    });
    const r = parseRefinements(sp("runtime=forever&language=klingon"), null);
    expect(r.runtime).toBeNull();
    expect(r.language).toBeNull();
  });

  it("ignores unknown era/tempo values", () => {
    const r = parseRefinements(sp("era=future&tempo=warp"), null);
    expect(r.era).toBeNull();
    expect(r.tempo).toBeNull();
  });
});

describe("applyRefinements", () => {
  it("maps runtime short/long to a runtime bound", () => {
    const short: Record<string, string> = {};
    applyRefinements(short, { ...EMPTY_REFINEMENTS, runtime: "short" });
    expect(short["with_runtime.lte"]).toBe("100");

    const long: Record<string, string> = {};
    applyRefinements(long, { ...EMPTY_REFINEMENTS, runtime: "long" });
    expect(long["with_runtime.gte"]).toBe("150");
  });

  it("maps language to with_original_language", () => {
    const en: Record<string, string> = {};
    applyRefinements(en, { ...EMPTY_REFINEMENTS, language: "en" });
    expect(en.with_original_language).toBe("en");

    const scand: Record<string, string> = {};
    applyRefinements(scand, { ...EMPTY_REFINEMENTS, language: "scand" });
    expect(scand.with_original_language).toBe("en|no|sv|da|fi|is");
  });

  it("appends exclude to the mood's own exclusions", () => {
    const p: Record<string, string> = { without_genres: "27" };
    applyRefinements(p, { ...EMPTY_REFINEMENTS, exclude: "99" });
    expect(p.without_genres).toBe("27,99");
  });

  // Tempo is applied after runtime so it wins, never leaving both bounds set.
  it("lets tempo override the runtime refinement", () => {
    const p: Record<string, string> = {};
    applyRefinements(p, {
      ...EMPTY_REFINEMENTS,
      runtime: "short",
      tempo: "slowburn",
    });
    expect(p["with_runtime.lte"]).toBeUndefined();
    expect(p["with_runtime.gte"]).toBe("120");
  });

  it("keeps the runtime floor under every runtime × tempo combination", () => {
    for (const runtime of [null, "short", "long"]) {
      for (const tempo of [null, "slowburn", "fastpaced"] as const) {
        const p = buildMoodParams("laugh");
        applyRefinements(p, { ...EMPTY_REFINEMENTS, runtime, tempo });
        expect(Number(p["with_runtime.gte"])).toBeGreaterThanOrEqual(RUNTIME_FLOOR);
      }
    }
  });

  it("leaves params untouched with no refinements", () => {
    const p: Record<string, string> = { with_genres: "35" };
    applyRefinements(p, EMPTY_REFINEMENTS);
    expect(p).toEqual({ with_genres: "35" });
  });
});

describe("activeRefinementKeys", () => {
  it("lists nothing for empty refinements", () => {
    expect(activeRefinementKeys(EMPTY_REFINEMENTS)).toEqual([]);
  });

  // Text keywords aren't a filter the user can remove, so they're never probed.
  it("lists every set user filter but never extraKeywords", () => {
    expect(
      activeRefinementKeys({
        runtime: "short",
        language: "en",
        exclude: "27",
        era: "classic",
        tempo: "slowburn",
        extraKeywords: [1, 2],
      }),
    ).toEqual(["era", "tempo", "runtime", "language", "exclude"]);
    expect(activeRefinementKeys({ ...EMPTY_REFINEMENTS, extraKeywords: [1] })).toEqual([]);
  });
});

describe("withoutRefinement", () => {
  it("clears one filter and leaves the rest", () => {
    const r = { ...EMPTY_REFINEMENTS, era: "classic" as const, runtime: "short", extraKeywords: [9] };
    expect(withoutRefinement(r, "era")).toEqual({ ...r, era: null });
    expect(r.era).toBe("classic");
  });
});
