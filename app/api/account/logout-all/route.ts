import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

// POST /api/account/logout-all
// Revokes every refresh token for the signed-in user. Active access tokens
// remain valid until they expire (default 1h), but they cannot be refreshed,
// so all other devices effectively log out within the hour. The client
// should also call supabase.auth.signOut() locally to clear the current
// device immediately.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await getSupabaseAdmin().auth.admin.signOut(user.id);
    if (error) return internalError(error, "Failed to sign out devices");
    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error, "Failed to sign out devices");
  }
}
