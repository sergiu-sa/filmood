import { NextRequest, NextResponse } from "next/server";
import { internalError, badRequest } from "@/lib/api-errors";
import {
  parseTMDBId,
  mapTMDBProvider,
  type TMDBProviderRaw,
} from "@/lib/tmdb";
import type {
  RegionAvailability,
  RegionalAvailabilityResponse,
  Provider,
} from "@/lib/types";

export const revalidate = 86400;

const FALLBACK_DEFAULT = "NO";

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

// GET /api/movies/[id]/regional-availability
// Returns provider list + certification + release date per country in one
// payload so the client can switch regions without re-fetching.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = parseTMDBId(id);
  if (movieId === null) return badRequest("Invalid movie id");

  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    );
  }

  try {
    const [provRes, releaseRes] = await Promise.all([
      fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${apiKey}`,
        { next: { revalidate: 86400 } },
      ),
      fetch(
        `https://api.themoviedb.org/3/movie/${movieId}/release_dates?api_key=${apiKey}`,
        { next: { revalidate: 86400 } },
      ),
    ]);

    const providersByCountry: ProvidersByCountry = provRes.ok
      ? ((await provRes.json()).results ?? {})
      : {};
    const releaseByCountry: ReleaseByCountry = releaseRes.ok
      ? ((await releaseRes.json()).results ?? [])
      : [];

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

    // Vercel geo header → ?country= override → fallback. Skips any step
    // that doesn't have data for this film.
    const headerRegion = request.headers.get("x-vercel-ip-country")?.toUpperCase();
    const queryRegion = request.nextUrl.searchParams
      .get("country")
      ?.toUpperCase();
    const candidates = [headerRegion, queryRegion, FALLBACK_DEFAULT].filter(
      (c): c is string => !!c,
    );
    const defaultRegion =
      candidates.find((c) => regions[c]) ??
      Object.keys(regions)[0] ??
      null;

    const body: RegionalAvailabilityResponse = { regions, defaultRegion };
    return NextResponse.json(body);
  } catch (error) {
    return internalError(error, "Failed to fetch regional availability");
  }
}
