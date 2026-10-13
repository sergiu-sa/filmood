import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

// DELETE /api/account/delete
// Permanently deletes the signed-in user. Every table that references
// auth.users(id) cascades: watchlists, mood_history, streaming_preferences,
// film_views, and since migration 014 the sessions they hosted (everyone else's
// pages go back to /group) and their seat and votes in other sessions.
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
    if (error) return internalError(error, "Failed to delete account");
    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error, "Failed to delete account");
  }
}
