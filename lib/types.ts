export interface Film {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
}

export type AccentColor = "gold" | "blue" | "rose" | "violet" | "teal" | "ember";

export interface MoodConfig {
  key: string;
  tagLabel: string;
  label: string;
  description: string;
  accentColor: AccentColor;
  genres: number[];
  excludeGenres?: number[];
  sortBy: "popularity.desc" | "vote_average.desc";
  voteCountGte: number;
  voteAverageGte?: number;
  /** TMDB keyword IDs joined with OR into with_keywords for sharper targeting. */
  keywords?: number[];
  /**
   * Hand-curated "signature" film used by the home hero to represent this mood.
   * posterPath is TMDB's /<size>/path.jpg (relative); fill via scripts/fetch-signature-posters.ts.
   */
  signatureFilm?: {
    tmdbId: number;
    title: string;
    year: number;
    posterPath: string | null;
  };
}

export type EraKey = "classic" | "modern" | "fresh";
export type TempoKey = "slowburn" | "fastpaced";

// ─── Film Detail Types ─────────────────────────────

/** A crew member surfaced on the film detail page (director, writer, DP, composer). */
export interface CrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

/** Full movie data returned by TMDB /movie/{id}?append_to_response=credits */
export interface FilmDetail {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: { id: number; name: string }[];
  credits: {
    cast: {
      id: number;
      name: string;
      character: string;
      profile_path: string | null;
    }[];
    crew: CrewMember[];
  };
  external_ids?: ExternalIds | null;
}

/** A single streaming provider (e.g. Netflix, Viaplay) */
export interface Provider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

/** A YouTube trailer from TMDB /movie/{id}/videos */
export interface TrailerData {
  key: string;
  name: string;
  site: string;
  type: string;
}

/** Projected single image from TMDB /movie/{id}/images. `kind` is injected at projection time. */
export interface MovieImage {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  kind: "poster" | "backdrop";
}

/**
 * Projected video entry from TMDB /movie/{id}/videos.
 * `type` is one of: "Trailer" | "Teaser" | "Clip" | "Featurette" | "Behind the Scenes" |
 * "Bloopers" | "Opening Credits". We pass it through as a string so unknown future types
 * don't break the projection.
 */
export interface MovieVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

/** TMDB keyword associated with a movie. */
export interface Keyword {
  id: number;
  name: string;
}

/**
 * External IDs from TMDB /movie/{id}/external_ids (also exposed via
 * append_to_response). All fields are individually nullable.
 */
export interface ExternalIds {
  imdb_id: string | null;
  facebook_id: string | null;
  instagram_id: string | null;
  twitter_id: string | null;
}

/**
 * Per-country availability bundle for the film detail page. Contains the
 * deduped provider list (flatrate/rent/buy merged), the local certification
 * (e.g. "PG-13", "16"), and the local theatrical release date.
 */
export interface RegionAvailability {
  providers: Provider[];
  certification: string | null;
  release_date: string | null;
}

/** Response shape for GET /api/movies/[id]/regional-availability. */
export interface RegionalAvailabilityResponse {
  /** Map keyed by ISO 3166-1 alpha-2 country code (uppercase). */
  regions: Record<string, RegionAvailability>;
  /** ISO country code chosen by the server as the default — or null when no region has data. */
  defaultRegion: string | null;
}

/** A single user review from TMDB /movie/{id}/reviews. */
export interface Review {
  id: string;
  author: string;
  /** Author's 1–10 rating, or null when not provided. */
  rating: number | null;
  /** Avatar URL — already absolute (TMDB stores Gravatar paths in their bucket). */
  avatar_url: string | null;
  content: string;
  created_at: string;
  url: string;
}

// ─── Deck Film (enriched for swipe cards) ────────────

/** A film inside a group session deck — carries genre IDs and the mood(s) it was sourced from */
export interface DeckFilm extends Film {
  genre_ids: number[];
  mood_keys: string[];
}

// ─── Group Session Types ──────────────────────────────

export type SessionStatus = "lobby" | "mood" | "swiping" | "done";
export type SwipeVote = "yes" | "no" | "maybe";

/** A group session row from the sessions table */
export interface GroupSession {
  id: string;
  code: string;
  host_id: string;
  status: SessionStatus;
  movie_deck: DeckFilm[] | null;
  created_at: string;
}

/** A participant row from session_participants */
export interface SessionParticipant {
  id: string;
  session_id: string;
  user_id: string | null;
  nickname: string;
  mood_selections: string[] | null;
  has_swiped: boolean;
  is_ready: boolean;
  joined_at: string;
  /** Raw free-form description — resolved to mood keys + keywords on submit. */
  mood_text: string | null;
  /** "classic" | "modern" | "fresh" — see EraKey. Nullable. */
  era: EraKey | null;
  /** "slowburn" | "fastpaced" — see TempoKey. Nullable. */
  tempo: TempoKey | null;
  /** TMDB keyword IDs resolved from mood_text. Default []. */
  extra_keywords: number[];
}

/** A swipe vote row from the swipes table */
export interface Swipe {
  id: string;
  session_id: string;
  participant_id: string;
  movie_id: number;
  vote: SwipeVote;
  created_at: string;
}

/** Tier a film falls into after vote aggregation on the results page */
export type ResultTier = "perfect" | "strong" | "miss";

/** A film from the deck with its aggregated vote breakdown and tier */
export interface MatchResult {
  movie: DeckFilm;
  tier: ResultTier;
  /** Normalized 0–1: sum of points / (participantCount * 2) */
  score: number;
  yesCount: number;
  maybeCount: number;
  noCount: number;
  /** Individual votes keyed by participant — useful for "who voted what" UI */
  votes: { participant_id: string; nickname: string; vote: SwipeVote | null }[];
}

/** Response shape for GET /api/group/[code]/results */
export interface GroupResultsPayload {
  code: string;
  participantCount: number;
  topPick: MatchResult | null;
  perfect: MatchResult[];
  strong: MatchResult[];
  miss: MatchResult[];
}
