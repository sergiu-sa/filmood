import {
  applyRefinements,
  parseRefinements,
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
