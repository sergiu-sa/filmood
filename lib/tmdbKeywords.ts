/**
 * Every TMDB keyword the mood engine uses, by name.
 * IDs are only trusted after `npm run check:moods -- --keywords` passes.
 */
export const TMDB_KEYWORDS = {
  // TMDB's "feel good" (383896) tags 2 films; its "feelgood" spelling is the populated one.
  feelGood:              { id: 275276, name: "feelgood" },
  heartwarming:          { id: 319357, name: "heartwarming" },
  friendship:            { id: 6054,   name: "friendship" },
  // TMDB's "romantic comedy" (383992) tags 1 film.
  romanticComedy:        { id: 9799,   name: "romcom" },
  tearjerker:            { id: 156924, name: "tearjerker" },
  grief:                 { id: 9872,   name: "grief" },
  lossOfLovedOne:        { id: 697,    name: "loss of loved one" },
  comingOfAge:           { id: 10683,  name: "coming of age" },
  // Tags slightly more films than TMDB's "nostalgia" (5609).
  nostalgic:             { id: 164246, name: "nostalgic" },
  childhood:             { id: 157955, name: "childhood" },
  basedOnTrueStory:      { id: 9672,   name: "based on true story" },
  underdog:              { id: 240,    name: "underdog" },
  biography:             { id: 5565,   name: "biography" },
  psychologicalThriller: { id: 12565,  name: "psychological thriller" },
  paranoia:              { id: 2340,   name: "paranoia" },
  neoNoir:               { id: 207268, name: "neo-noir" },
  revenge:               { id: 9748,   name: "revenge" },
  corruption:            { id: 417,    name: "corruption" },
  timeTravel:            { id: 4379,   name: "time travel" },
  twistEnding:           { id: 326438, name: "twist ending" },
  nonlinearTimeline:     { id: 157171, name: "nonlinear timeline" },
  surreal:               { id: 3307,   name: "surreal" },
  mindBending:           { id: 362567, name: "mind-bending" },
  dystopia:              { id: 4565,   name: "dystopia" },
  cultFilm:              { id: 374649, name: "cult film" },
  heist:                 { id: 10051,  name: "heist" },
} as const satisfies Record<string, { id: number; name: string }>;
