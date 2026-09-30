// The streaming services Filmood knows. Pure, so the profile picker, the
// streaming-preferences route and the discover route share one list.

/** `name` is what `streaming_preferences.platforms` stores; `tmdbNames` are TMDB's spellings. */
export const PLATFORMS = [
  { slug: "netflix", name: "Netflix", tmdbNames: ["Netflix"] },
  { slug: "viaplay", name: "Viaplay", tmdbNames: ["Viaplay"] },
  { slug: "hbo-max", name: "HBO Max", tmdbNames: ["HBO Max", "Max"] },
  { slug: "tv2-play", name: "TV 2 Play", tmdbNames: ["TV 2 Play"] },
  { slug: "disney-plus", name: "Disney+", tmdbNames: ["Disney Plus"] },
  { slug: "prime-video", name: "Prime Video", tmdbNames: ["Amazon Prime Video"] },
] as const;

export type PlatformSlug = (typeof PLATFORMS)[number]["slug"];

export function isPlatformName(name: string): boolean {
  return PLATFORMS.some((p) => p.name === name);
}

/**
 * `services` param → known slugs, deduped. PLATFORMS order, not input order,
 * so the same set always builds the same TMDB query and cache entry.
 */
export function parseServices(raw: string | null): PlatformSlug[] {
  const wanted = new Set((raw ?? "").split(",").map((s) => s.trim()));
  return PLATFORMS.filter((p) => wanted.has(p.slug)).map((p) => p.slug);
}

/** Stored display names → slugs, in PLATFORMS order; unknown names dropped. */
export function slugsFromNames(names: readonly string[]): PlatformSlug[] {
  return PLATFORMS.filter((p) => names.includes(p.name)).map((p) => p.slug);
}

/** The platforms for these slugs, in PLATFORMS order; unknown slugs dropped. */
export function platformsFor(slugs: readonly string[]) {
  return PLATFORMS.filter((p) => slugs.includes(p.slug));
}
