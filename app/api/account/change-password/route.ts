import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { internalError, badRequest } from "@/lib/api-errors";

const MIN_LENGTH = 8;

// POST /api/account/change-password
// Body: { newPassword: string }
// Updates the signed-in user's password via the admin API. The client
// already proved possession of the current session via the Authorization
// header — Supabase's admin update doesn't require the old password.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const newPassword = body.newPassword;
  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return badRequest(
      `newPassword must be a string of at least ${MIN_LENGTH} characters`,
    );
  }

  try {
    const { error } = await getSupabaseAdmin().auth.admin.updateUserById(
      user.id,
      { password: newPassword },
    );
    if (error) return internalError(error, "Failed to update password");
    return NextResponse.json({ success: true });
  } catch (error) {
    return internalError(error, "Failed to update password");
  }
}
