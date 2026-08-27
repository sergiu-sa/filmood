import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUser, getSupabaseAdmin } from "@/lib/supabase-server";
import { internalError, badRequest } from "@/lib/api-errors";

const MIN_LENGTH = 8;

/**
 * Verify the caller knows their current password before we let them set a new one.
 * A valid session alone isn't enough, a stolen/borrowed token shouldn't be able to change the password (which would lock the real owner out).
 * We confirm possession with a throwaway anon client so nothing about this verification touches the shared admin singleton's session.
 */
type PasswordCheck = "valid" | "wrong" | "unavailable";

async function checkCurrentPassword(
  email: string,
  password: string,
): Promise<PasswordCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Missing Supabase env vars");

  const verifier = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });

  // A successful sign-in mints a real refresh token server-side even though persistSession is off (that flag only governs local storage).
  // Revoke it so this verification doesn't leave an orphaned session behind.
  await verifier.auth.signOut().catch(() => {});

  if (!error) return "valid";
  // Only a genuine credential rejection means the password is wrong.
  // A network failure, GoTrue outage, or rate-limit response must NOT masquerade as an incorrect password;
  //   that would block a legitimate change with no signal.
  if (error.code === "invalid_credentials") return "wrong";
  return "unavailable";
}

// POST /api/account/change-password
// Body: { currentPassword: string, newPassword: string }
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { currentPassword, newPassword } = body;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return badRequest("currentPassword is required");
  }
  if (typeof newPassword !== "string" || newPassword.length < MIN_LENGTH) {
    return badRequest(
      `newPassword must be a string of at least ${MIN_LENGTH} characters`,
    );
  }
  if (newPassword === currentPassword) {
    return badRequest("New password must differ from the current one");
  }
  if (!user.email) {
    // Password auth requires an email identity; nothing to verify against.
    return badRequest("This account has no email/password login");
  }

  try {
    const check = await checkCurrentPassword(user.email, currentPassword);
    if (check === "wrong") {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 403 },
      );
    }
    if (check === "unavailable") {
      return NextResponse.json(
        { error: "Couldn't verify your current password right now. Try again." },
        { status: 503 },
      );
    }

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
