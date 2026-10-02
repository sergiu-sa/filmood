import { genreMap } from "@/lib/genres";
import { moodMap } from "@/lib/moodMap";
import type { Keyword } from "@/lib/types";

const moodIds = (moodKeys: readonly string[], field: "genres" | "keywords") =>
  new Set(moodKeys.flatMap((k) => (Object.hasOwn(moodMap, k) ? (moodMap[k][field] ?? []) : [])));

/** Up to `max` genre names, the film's moods' own genres first ("Comedy · Crime"). Unknown ids skipped. */
export function reasonGenres(genreIds: readonly number[], moodKeys: readonly string[], max = 2): string[] {
  const own = moodIds(moodKeys, "genres");
  const known = genreIds.filter((id) => Object.hasOwn(genreMap, id));
  return [...known.filter((id) => own.has(id)), ...known.filter((id) => !own.has(id))]
    .slice(0, max)
    .map((id) => genreMap[id]);
}

/** The film's TMDB keywords that its moods search on, by TMDB's name, up to `max`. */
export function matchedKeywords(keywords: readonly Keyword[], moodKeys: readonly string[], max = 2): string[] {
  const own = moodIds(moodKeys, "keywords");
  return keywords.filter((k) => own.has(k.id)).slice(0, max).map((k) => k.name);
}
