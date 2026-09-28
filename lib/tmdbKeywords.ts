/**
 * Every TMDB keyword the mood engine uses, by name.
 * IDs are only trusted after `npm run check:moods -- --keywords` passes.
 */
export const TMDB_KEYWORDS = {
  // TMDB has no populated "feel-good" keyword (the closest tags ~100 films).
  friendship:     { id: 6054,   name: "friendship" },
  romanticComedy: { id: 9799,   name: "romcom" },
  comingOfAge:    { id: 10683,  name: "coming of age" },
  mindBending:    { id: 362567, name: "mind-bending" },
  dystopia:       { id: 4565,   name: "dystopia" },
  neoNoir:        { id: 207268, name: "neo-noir" },
  cultFilm:       { id: 374649, name: "cult film" },
  heist:          { id: 10051,  name: "heist" },
} as const satisfies Record<string, { id: number; name: string }>;
