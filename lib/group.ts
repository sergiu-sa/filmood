import { randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";

// Characters that are easy to read and share aloud.
// Excluded: 0/O (zero vs oh), 1/I/L (one vs I vs L)
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const SESSION_EXPIRY_HOURS = 4;

/**
 * Generate a random 6-char code like "HK7T4N". The code is all that stands between a
 * stranger and a session's participant ids, so it comes from the CSPRNG: Math.random's
 * state can be recovered from its outputs, and every new session would show some.
 */
function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

/**
 * Generate a unique session code. Retries up to 5 times if a collision
 * is detected (extremely unlikely with 31^6 ≈ 887 million combinations).
 */
export async function generateUniqueCode(): Promise<string> {
  const supabase = getSupabaseAdmin();

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { data } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .single();

    // No match means this code is available
    if (!data) return code;
  }

  throw new Error("Failed to generate unique code");
}

/** Check if a session has passed the expiry window */
function isSessionExpired(createdAt: string): boolean {
  const created = new Date(createdAt).getTime();
  const now = Date.now();
  return now - created > SESSION_EXPIRY_HOURS * 60 * 60 * 1000;
}

/** Classify a film into a tier based on vote breakdown */
function classifyTier(
  yesCount: number,
  noCount: number,
  participantCount: number,
): "perfect" | "strong" | "miss" {
  if (participantCount === 0) return "miss";
  if (yesCount === participantCount) return "perfect";
  if (noCount === 0 && yesCount >= Math.ceil(participantCount / 2)) {
    return "strong";
  }
  return "miss";
}

export { SESSION_EXPIRY_HOURS, isSessionExpired, classifyTier };
