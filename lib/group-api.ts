import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { isSessionExpired } from "@/lib/group";
import { internalError } from "@/lib/api-errors";
import { MAX_PARTICIPANTS } from "@/lib/constants";

type ResolveResult<T> =
  | { session: T; error: null }
  | { session: null; error: NextResponse };

type ParticipantResult<T> =
  | { participant: T; error: null }
  | { participant: null; error: NextResponse };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the 6-char code, fetch the session, and check expiry.
 * Returns the session row or an error response ready to return.
 */
export async function resolveSession<
  T extends { created_at: string } = { created_at: string },
>(
  supabase: SupabaseClient,
  code: string,
  selectFields = "id, status, created_at",
): Promise<ResolveResult<T>> {
  if (!code || code.length !== 6) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Invalid session code" },
        { status: 400 },
      ),
    };
  }

  const upperCode = code.toUpperCase();

  // maybeSingle answers no row with data null, so an error is a failed read. Only a missing row may be
  // a 404: the lobby reads a 404 after it has loaded as a disband and sends everyone to /group.
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select(selectFields)
    .eq("code", upperCode)
    .maybeSingle();

  if (sessionError) {
    return { session: null, error: internalError(sessionError, "Failed to load session") };
  }

  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Session not found" },
        { status: 404 },
      ),
    };
  }

  if (isSessionExpired((session as unknown as { created_at: string }).created_at)) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "Session expired" },
        { status: 410 },
      ),
    };
  }

  return { session: session as unknown as T, error: null };
}

/**
 * Find a participant by user_id (authenticated) or participantId (guest).
 * Returns the participant row or an error response.
 */
export async function resolveParticipant<
  T extends { id: string } = { id: string },
>(
  supabase: SupabaseClient,
  sessionId: string,
  user: User | null,
  participantId: string | null,
  selectFields = "id",
): Promise<ParticipantResult<T>> {
  if (!user && !participantId) {
    return {
      participant: null,
      error: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      ),
    };
  }

  const notInSession = () => ({
    participant: null,
    error: NextResponse.json({ error: "You are not in this session" }, { status: 403 }),
  });

  // Routes pass the body field or query param unchecked. Anything but a uuid string can't match a row,
  // and a long one gets a 414 from Supabase's gateway with no error code, which would read as a failed read.
  if (!user && (typeof participantId !== "string" || !UUID.test(participantId))) return notInSession();

  const baseQuery = supabase
    .from("session_participants")
    .select(selectFields)
    .eq("session_id", sessionId);

  // A guest's row id is its only credential, and anyone with the code sees every row id,
  // so it must never act for a signed-in row: the host's would disband the session.
  const filteredQuery = user
    ? baseQuery.eq("user_id", user.id)
    : baseQuery.eq("id", participantId!).is("user_id", null);

  const { data: participant, error: participantError } = await filteredQuery.maybeSingle();

  // A failed read isn't "not in this session": join would seat them a second time.
  if (participantError) {
    return { participant: null, error: internalError(participantError, "Failed to load participant") };
  }

  if (!participant) return notInSession();

  return { participant: participant as unknown as T, error: null };
}

/**
 * The seat ids the host's confirm named, from a host's carry-on body. Null for anything but a list of
 * strings no longer than a session can seat.
 */
export function confirmedIds(body: unknown): Set<string> | null {
  const ids = (body as { participantIds?: unknown } | null)?.participantIds;
  if (!Array.isArray(ids) || ids.length > MAX_PARTICIPANTS || !ids.every((id) => typeof id === "string")) {
    return null;
  }
  return new Set(ids);
}
