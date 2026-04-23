"use client";

import { useSyncExternalStore } from "react";

// localStorage doesn't fire events for same-tab writes, and participantId is
// only ever written once per session (on create/join). A no-op subscribe is
// sufficient — useSyncExternalStore re-reads the snapshot on every render.
const subscribe = () => () => {};
const getSnapshot = () => localStorage.getItem("participantId");
const getServerSnapshot = () => null;
const getReadyClient = () => true;
const getReadyServer = () => false;

/**
 * Reads the guest participantId from localStorage synchronously (via
 * useSyncExternalStore — matches the pattern in lib/useMediaQuery.ts).
 *
 * Returns { participantId, ready }:
 *   - On SSR + first client paint: participantId=null, ready=false.
 *   - After hydration: participantId=<stored value or null>, ready=true.
 *
 * Callers gate API requests on `ready` so authed users with no guest ID
 * (participantId=null, ready=true) aren't confused with "haven't checked yet"
 * (participantId=null, ready=false).
 */
export function useParticipantId() {
  const participantId = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const ready = useSyncExternalStore(
    subscribe,
    getReadyClient,
    getReadyServer,
  );
  return { participantId, ready };
}
