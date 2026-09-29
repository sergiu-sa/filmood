import { mulberry32, newSeed, parseSeed, SEED_MAX } from "@/lib/seededRandom";

const take = (rng: () => number, n: number) => Array.from({ length: n }, rng);

describe("mulberry32", () => {
  it("repeats the same sequence for the same seed", () => {
    expect(take(mulberry32(42), 10)).toEqual(take(mulberry32(42), 10));
  });

  it("gives different sequences for different seeds", () => {
    expect(take(mulberry32(42), 10)).not.toEqual(take(mulberry32(43), 10));
  });

  it("stays in [0, 1)", () => {
    for (const v of take(mulberry32(7), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("parseSeed", () => {
  it.each([
    ["1", 1],
    ["2147483646", 2147483646],
  ])("accepts %j", (raw, seed) => {
    expect(parseSeed(raw)).toBe(seed);
  });

  it.each([null, "", "0", "-5", "1.5", "12abc", "2147483647", " 5", "1e3"])(
    "rejects %j",
    (raw) => {
      expect(parseSeed(raw)).toBeNull();
    },
  );
});

describe("newSeed", () => {
  it("returns a seed parseSeed accepts", () => {
    for (let i = 0; i < 100; i++) {
      const seed = newSeed();
      expect(parseSeed(String(seed))).toBe(seed);
      expect(seed).toBeLessThanOrEqual(SEED_MAX);
    }
  });
});
