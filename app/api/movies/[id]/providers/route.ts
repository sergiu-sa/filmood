import { NextRequest, NextResponse } from "next/server";

// GET /api/movies/[id]/providers
// Streaming providers for a movie, scoped to Norway (country code "NO").
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "TMDB API key not configured" },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/movie/${id}/watch/providers?api_key=${apiKey}`,
    );
    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch watch providers" },
        { status: response.status },
      );
    }
    const data = await response.json();

    const results = data.results?.NO;
    if (!results) {
      return NextResponse.json({ providers: [] });
    }

    const allProviders = [
      ...(results.flatrate || []),
      ...(results.rent || []),
      ...(results.buy || []),
    ];

    const uniqueProviders = Array.from(
      new Map(allProviders.map((p: any) => [p.provider_id, p])).values(),
    );

    return NextResponse.json({ providers: uniqueProviders });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
