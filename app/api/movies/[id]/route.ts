import { NextRequest, NextResponse } from "next/server";
import { tmdbError, badRequest } from "@/lib/api-errors";
import { parseTMDBId, tmdbJson } from "@/lib/tmdb";
import type { CrewMember } from "@/lib/types";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { recordFilmView } from "@/lib/film-views";

export const revalidate = 86400;

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
 *  this route projects. Everything else in the payload is dropped. */
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = parseTMDBId(id);
  if (movieId === null) return badRequest("Invalid movie id");

  try {
    const data = await tmdbJson<RawMovieDetail>(`/movie/${movieId}`, {
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

    // Fire-and-forget: record the view for authenticated users so the
    // profile "Continue researching" rail has data. Guests are skipped.
    // Errors are caught and logged — must not block the response.
    const user = await getAuthUser(request);
    if (user) {
      recordFilmView(getSupabaseAdmin(), user.id, {
        movie_id: data.id,
        movie_title: data.title,
        poster_path: data.poster_path,
      }).catch((err) => console.error("film_views insert failed", err));
    }

    return NextResponse.json({
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
    });
  } catch (error) {
    return tmdbError(error, "Failed to fetch movie details");
  }
}
