import type { Film } from "@/lib/types";

// Minimal shape we care about from a TMDB discover/search/list response.
// TMDB returns many extra fields (popularity, adult, video, genre_ids, ...);
// mapTMDBFilm is the explicit boundary that drops them before they reach
// the client.
type TMDBFilmRaw = {
  id: number;
  title: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  overview: string;
};

export function mapTMDBFilm(raw: TMDBFilmRaw): Film {
  return {
    id: raw.id,
    title: raw.title,
    poster_path: raw.poster_path,
    release_date: raw.release_date,
    vote_average: raw.vote_average,
    overview: raw.overview,
  };
}
