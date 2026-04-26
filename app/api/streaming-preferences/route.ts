import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin, getAuthUser } from "@/lib/supabase-server";
import { internalError, badRequest } from "@/lib/api-errors";

// Allow-list of platform names. Extending the list is a one-line change
// here + the StreamingPreferences component.
const KNOWN_PLATFORMS = new Set([
  "Netflix",
  "Viaplay",
  "HBO Max",
  "TV 2 Play",
  "Disney+",
  "Prime Video",
]);

// GET /api/streaming-preferences
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ platforms: [] });
  }
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("streaming_preferences")
      .select("platforms")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) return internalError(error, "Failed to load preferences");
    return NextResponse.json({ platforms: data?.platforms ?? [] });
  } catch (error) {
    return internalError(error, "Failed to load preferences");
  }
}

// PUT /api/streaming-preferences
// Body: { platforms: string[] } — replaces the user's full set in one call.
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { platforms?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!Array.isArray(body.platforms)) {
    return badRequest("platforms must be an array of strings");
  }
  const platforms = (body.platforms as unknown[])
    .filter((p): p is string => typeof p === "string")
    .filter((p) => KNOWN_PLATFORMS.has(p));

  try {
    const { error } = await getSupabaseAdmin()
      .from("streaming_preferences")
      .upsert(
        {
          user_id: user.id,
          platforms,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
    if (error) return internalError(error, "Failed to save preferences");
    return NextResponse.json({ platforms });
  } catch (error) {
    return internalError(error, "Failed to save preferences");
  }
}
