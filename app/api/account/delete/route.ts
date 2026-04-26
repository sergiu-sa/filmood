import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { internalError } from "@/lib/api-errors";

// DELETE /api/account/delete
// Permanently deletes the signed-in user. Cascade rules on the Supabase
// tables (watchlists / mood_history / streaming_preferences / film_views
// all reference auth.users(id) on delete cascade) take care of associated
// data. Group session participations are kept (they're shared with other
// users) but the user_id column will be nulled by the cascade.
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
