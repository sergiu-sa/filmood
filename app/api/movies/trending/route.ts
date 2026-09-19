import { NextResponse } from "next/server";
import { tmdbError } from "@/lib/api-errors";
import { tmdbJson } from "@/lib/tmdb";

type RawTrendingFilm = {
  id: number;
  title: string;
  genre_ids: number[];
  poster_path: string | null;
  backdrop_path: string | null;
};

// Wider projection than mapTMDBFilm: the dashboard rails need genre_ids for
// their labels and backdrop_path for the ambient hero wash.
export async function GET() {
  try {
    // Uncached, matching this route's long-standing behaviour — trending
    // turns over through the day and the dashboard reads it on every load.
    const data = await tmdbJson<{ results?: RawTrendingFilm[] }>(
      "/trending/movie/day",
      { language: "en-US" },
      false,
    );

    const films = (data.results ?? []).slice(0, 4).map((f) => ({
      id: f.id,
      title: f.title,
      genre_ids: f.genre_ids,
      poster_path: f.poster_path,
      backdrop_path: f.backdrop_path,
    }));

    return NextResponse.json({ films });
  } catch (error) {
    return tmdbError(error, "Failed to fetch trending films");
  }
}
