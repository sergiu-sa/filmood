// A `seed` in the results URL drives every random choice in a mood search, so
// the same URL gives the same list on Back/forward. Pure: the client and the
// server both use it.

/** Deterministic PRNG: same seed → same sequence. Enough for shuffles; not for anything secret. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const SEED_MAX = 2147483646;

/** Integer in 1..SEED_MAX, else null. Rejects "12abc", floats, 0, negatives. */
export function parseSeed(raw: string | null): number | null {
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const seed = Number(raw);
  return seed <= SEED_MAX ? seed : null;
}

export function newSeed(): number {
  return 1 + Math.floor(Math.random() * SEED_MAX);
}
