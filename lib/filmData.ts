// Film-page data, shared by the page and the routes that still need it.
// Server-only: it reaches TMDB through lib/tmdb-fetch.

import {
  mapTMDBFilm,
  mapTMDBProvider,
  tmdbImageUrl,
  type TMDBProviderRaw,
} from "@/lib/tmdb";
import { tmdbJson, tmdbJsonOptional, settleTMDB } from "@/lib/tmdb-fetch";
import type {
  CrewMember,
  Film,
  FilmDetail,
  Keyword,
  MovieImage,
  MovieVideo,
  Provider,
  RegionAvailability,
  RegionalAvailabilityResponse,
  Review,
} from "@/lib/types";

// ─── Detail ─────────────────────────────────────────

const RELEVANT_CREW_JOBS = new Set([
  "Director",
  "Screenplay",
  "Writer",
  "Story",
  "Director of Photography",
  "Original Music Composer",
]);

type RawCrewMember = {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
};

type RawCastMember = {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
};

/** The subset of TMDB's /movie/{id}?append_to_response=credits,external_ids
 *  this projects. Everything else in the payload is dropped. */
type RawMovieDetail = {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  runtime: number | null;
  vote_average: number;
  genres: { id: number; name: string }[];
  credits?: { cast?: RawCastMember[]; crew?: RawCrewMember[] };
  external_ids?: {
    imdb_id?: string | null;
    facebook_id?: string | null;
    instagram_id?: string | null;
    twitter_id?: string | null;
  };
};

export async function getFilmDetail(id: number): Promise<FilmDetail> {
  const data = await tmdbJson<RawMovieDetail>(`/movie/${id}`, {
    append_to_response: "credits,external_ids",
  });

  // TMDB lists the same person under multiple credit_ids for the same job
  // — dedupe by id+job after filtering.
  const crewSeen = new Set<string>();
  const crew: CrewMember[] = (data.credits?.crew ?? [])
    .filter((m) => RELEVANT_CREW_JOBS.has(m.job))
    .filter((m) => {
      const key = `${m.id}:${m.job}`;
      if (crewSeen.has(key)) return false;
      crewSeen.add(key);
      return true;
    })
    .map((m) => ({
      id: m.id,
      name: m.name,
      job: m.job,
      department: m.department,
      profile_path: m.profile_path,
    }));

  const externalIds = data.external_ids
    ? {
        imdb_id: data.external_ids.imdb_id ?? null,
        facebook_id: data.external_ids.facebook_id ?? null,
        instagram_id: data.external_ids.instagram_id ?? null,
        twitter_id: data.external_ids.twitter_id ?? null,
      }
    : null;

  return {
    id: data.id,
    title: data.title,
    overview: data.overview,
    poster_path: data.poster_path,
    backdrop_path: data.backdrop_path,
    release_date: data.release_date,
    runtime: data.runtime,
    vote_average: data.vote_average,
    genres: data.genres,
    external_ids: externalIds,
    credits: {
      cast: (data.credits?.cast ?? []).slice(0, 10).map((member) => ({
        id: member.id,
        name: member.name,
        character: member.character,
        profile_path: member.profile_path,
      })),
      crew,
    },
  };
}

// ─── Regional availability ──────────────────────────

const DEFAULT_REGION = "NO";

type ProvidersByCountry = Record<
  string,
  { flatrate?: TMDBProviderRaw[]; rent?: TMDBProviderRaw[]; buy?: TMDBProviderRaw[] }
>;

type ReleaseDateEntry = {
  iso_639_1?: string;
  certification?: string;
  release_date?: string;
  type?: number;
};

type ReleaseByCountry = Array<{
  iso_3166_1: string;
  release_dates: ReleaseDateEntry[];
}>;

function dedupeProviders(group: ProvidersByCountry[string]): Provider[] {
  const all: TMDBProviderRaw[] = [
    ...(group.flatrate ?? []),
    ...(group.rent ?? []),
    ...(group.buy ?? []),
  ];
  return Array.from(
    new Map(all.map((p) => [p.provider_id, p])).values(),
  ).map(mapTMDBProvider);
}

// TMDB emits multiple release types per country (theatrical, digital, …)
// each with their own cert. Prefer theatrical (type 3) over the first
// non-empty fallback.
function pickCertification(entries: ReleaseDateEntry[]): string | null {
  const theatrical = entries.find(
    (e) => e.type === 3 && e.certification && e.certification.length > 0,
  );
  if (theatrical?.certification) return theatrical.certification;
  const any = entries.find((e) => e.certification && e.certification.length > 0);
  return any?.certification ?? null;
}

function pickReleaseDate(entries: ReleaseDateEntry[]): string | null {
  // Prefer theatrical release; fall back to earliest.
  const theatrical = entries.find((e) => e.type === 3 && e.release_date);
  if (theatrical?.release_date) return theatrical.release_date;
  const dated = entries
    .map((e) => e.release_date)
    .filter((d): d is string => !!d)
    .sort();
  return dated[0] ?? null;
}

/** Provider list + certification + release date per country in one payload,
 *  so the client can switch regions without re-fetching. */
export async function getRegionalAvailability(
  id: number,
): Promise<RegionalAvailabilityResponse> {
  // Providers and release dates degrade independently — a film may have one
  // and not the other.
  const { values, firstRejection } = await settleTMDB<{
    results?: ProvidersByCountry | ReleaseByCountry;
  }>([
    tmdbJsonOptional<{ results?: ProvidersByCountry }>(
      `/movie/${id}/watch/providers`,
    ),
    tmdbJsonOptional<{ results?: ReleaseByCountry }>(
      `/movie/${id}/release_dates`,
    ),
  ]);
  const providersByCountry = (values[0]?.results ?? {}) as ProvidersByCountry;
  const releaseByCountry = (values[1]?.results ?? []) as ReleaseByCountry;

  const regions: Record<string, RegionAvailability> = {};

  for (const [country, group] of Object.entries(providersByCountry)) {
    const providers = dedupeProviders(group);
    if (providers.length === 0) continue;
    regions[country.toUpperCase()] = {
      providers,
      certification: null,
      release_date: null,
    };
  }

  for (const entry of releaseByCountry) {
    const country = entry.iso_3166_1?.toUpperCase();
    if (!country) continue;
    const certification = pickCertification(entry.release_dates ?? []);
    const release_date = pickReleaseDate(entry.release_dates ?? []);
    if (!certification && !release_date) continue;
    const existing = regions[country] ?? {
      providers: [],
      certification: null,
      release_date: null,
    };
    regions[country] = { ...existing, certification, release_date };
  }

  // A 404 on one leg resolves to {}, so "every promise rejected" would miss
  // the case where the other genuinely failed and nothing usable remains.
  if (Object.keys(regions).length === 0 && firstRejection) {
    throw firstRejection;
  }

  // Norway, like the rest of the app; the client's saved region wins over this.
  const defaultRegion = regions[DEFAULT_REGION]
    ? DEFAULT_REGION
    : (Object.keys(regions)[0] ?? null);

  return { regions, defaultRegion };
}

// ─── Videos ─────────────────────────────────────────

const TYPE_ORDER: Record<string, number> = {
  Trailer: 0,
  Teaser: 1,
  Clip: 2,
  Featurette: 3,
  "Behind the Scenes": 4,
};

type RawVideo = {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
};

/** All YouTube videos for a movie, sorted by type (Trailer first) then date. */
export async function getFilmVideos(id: number): Promise<MovieVideo[]> {
  const data = await tmdbJson(`/movie/${id}/videos`);
  const raw = (data.results ?? []) as RawVideo[];

  return raw
    .filter((v) => v.site === "YouTube")
    .map((v) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
      published_at: v.published_at,
    }))
    .sort((a, b) => {
      const orderA = TYPE_ORDER[a.type] ?? 99;
      const orderB = TYPE_ORDER[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return b.published_at.localeCompare(a.published_at);
    });
}

// ─── Images ─────────────────────────────────────────

const POSTER_LIMIT = 12;
const BACKDROP_LIMIT = 16;

type RawImage = {
  file_path: string;
  width: number;
  height: number;
  aspect_ratio: number;
  vote_average: number;
};

function projectImage(raw: RawImage, kind: "poster" | "backdrop"): MovieImage {
  return {
    file_path: raw.file_path,
    width: raw.width,
    height: raw.height,
    aspect_ratio: raw.aspect_ratio,
    kind,
  };
}

/** Posters + backdrops, sorted by vote_average. include_image_language=en,null
 *  keeps English-titled and language-neutral images for non-English films. */
export async function getFilmImages(
  id: number,
): Promise<{ posters: MovieImage[]; backdrops: MovieImage[] }> {
  const data = await tmdbJson(`/movie/${id}/images`, {
    include_image_language: "en,null",
  });
  const rawPosters = (data.posters ?? []) as RawImage[];
  const rawBackdrops = (data.backdrops ?? []) as RawImage[];

  const posters = [...rawPosters]
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(0, POSTER_LIMIT)
    .map((p) => projectImage(p, "poster"));

  const backdrops = [...rawBackdrops]
    .sort((a, b) => b.vote_average - a.vote_average)
    .slice(0, BACKDROP_LIMIT)
    .map((b) => projectImage(b, "backdrop"));

  return { posters, backdrops };
}

// ─── Keywords ───────────────────────────────────────

const KEYWORD_LIMIT = 20;

type RawKeyword = { id: number; name: string };

/** Themes/topics associated with a movie (TMDB keywords). */
export async function getFilmKeywords(id: number): Promise<Keyword[]> {
  const data = await tmdbJson(`/movie/${id}/keywords`);
  const raw = (data.keywords ?? []) as RawKeyword[];
  return raw.slice(0, KEYWORD_LIMIT).map((k) => ({ id: k.id, name: k.name }));
}

// ─── Related ────────────────────────────────────────

const RELATED_LIMIT = 16;

type RawListResponse = {
  results?: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
    vote_average: number;
    overview: string;
  }>;
};

/** Recommendations (TMDB's editorially-tuned list) when available, falling
 *  back to similar (algorithmic by genre+keywords). Reports `source` so the
 *  UI can label the rail correctly. */
export async function getRelatedFilms(
  id: number,
): Promise<{ films: Film[]; source: "recommendations" | "similar" }> {
  // A fallback pair: one leg failing must not discard the other.
  const { values, firstRejection } = await settleTMDB([
    tmdbJsonOptional<RawListResponse>(`/movie/${id}/recommendations`),
    tmdbJsonOptional<RawListResponse>(`/movie/${id}/similar`),
  ]);
  const [rec, sim] = [0, 1].map((i) =>
    (values[i]?.results ?? []).filter((f) => f.poster_path),
  );

  // Nothing usable plus a real failure is an outage, not "no related films".
  if (rec.length === 0 && sim.length === 0 && firstRejection) {
    throw firstRejection;
  }

  const useRecommendations = rec.length > 0;
  const source: "recommendations" | "similar" = useRecommendations
    ? "recommendations"
    : "similar";

  const films: Film[] = (useRecommendations ? rec : sim)
    .slice(0, RELATED_LIMIT)
    .map(mapTMDBFilm);

  return { films, source };
}

// ─── Reviews ────────────────────────────────────────

const REVIEW_LIMIT = 5;

type RawReview = {
  id: string;
  author: string;
  author_details?: {
    avatar_path?: string | null;
    rating?: number | null;
  } | null;
  content: string;
  created_at: string;
  url: string;
};

/**
 * TMDB stores Gravatar avatars as `/https://...` (path starts with a slash
 * containing the full URL). When the path begins with `/http`, strip the
 * leading slash to get the real URL — otherwise it's a TMDB-hosted relative
 * path and we resolve it via the image CDN.
 */
function resolveAvatar(rawPath: string | null | undefined): string | null {
  if (!rawPath) return null;
  if (rawPath.startsWith("/http")) return rawPath.slice(1);
  return tmdbImageUrl(rawPath, "w185");
}

/** Top REVIEW_LIMIT reviews, newest first. */
export async function getFilmReviews(id: number): Promise<Review[]> {
  const data = await tmdbJson(`/movie/${id}/reviews`);
  const raw = (data.results ?? []) as RawReview[];

  return [...raw]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, REVIEW_LIMIT)
    .map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.author_details?.rating ?? null,
      avatar_url: resolveAvatar(r.author_details?.avatar_path),
      content: r.content,
      created_at: r.created_at,
      url: r.url,
    }));
}
