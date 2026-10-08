"use client";

// "My services" on the client: this device's list in localStorage (guests, and
// signed-in users who chose not to save) and a signed-in user's saved list.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { parseServices, platformsFor, slugsFromNames, type PlatformSlug } from "@/lib/platforms";

export const SERVICES_STORAGE_KEY = "filmood:services";

function readRaw(): string | null {
  try {
    return localStorage.getItem(SERVICES_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** This device's services, allow-listed by parseServices; [] when none or storage is blocked. */
export function readDeviceServices(): PlatformSlug[] {
  return parseServices(readRaw());
}

/** false when storage is blocked: the search still runs with them, they just aren't remembered. */
export function writeDeviceServices(slugs: readonly PlatformSlug[]): boolean {
  try {
    localStorage.setItem(SERVICES_STORAGE_KEY, slugs.join(","));
    return true;
  } catch {
    return false;
  }
}

// No-op subscribe: every write is followed by a URL change, whose re-render
// re-reads the snapshot. Subscribing would re-render the page a second time.
const subscribe = () => () => {};

/** Re-read on every render, like useParticipantId: every write is followed by a URL change. */
export function useDeviceServices(): PlatformSlug[] {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null);
  return useMemo(() => parseServices(raw), [raw]);
}

export interface Services {
  /** What "My services" means here, in resolveWhere's order: saved (signed in, non-empty), else this device's. */
  list: PlatformSlug[];
  /** Services saved to the profile: an edit must save there (Q4). */
  saved: boolean;
  signedIn: boolean;
  /** Signed in and the saved read hasn't answered, so whether an edit must save to the profile isn't known yet. */
  loading: boolean;
  /** toProfile PUTs display names; otherwise writes this device. Rejects when the PUT fails. */
  save(slugs: PlatformSlug[], toProfile: boolean): Promise<void>;
}

export function useServices(): Services {
  const userId = useAuth().user?.id ?? null;
  const device = useDeviceServices();
  // Keyed by user, so a sign-out or account switch never shows the last user's list.
  const [fetched, setFetched] = useState<{ userId: string; slugs: PlatformSlug[] } | null>(null);
  // Bumped by every read and every successful save. A read answers only if it's
  // still the latest, so a slow one can't put back the list a save replaced.
  const latest = useRef(0);

  useEffect(() => {
    if (!userId) return;
    const id = ++latest.current;
    (async () => {
      let slugs: PlatformSlug[] = [];
      try {
        const res = await fetch("/api/streaming-preferences", { headers: await getAuthHeaders() });
        const body: { platforms?: unknown } = res.ok ? await res.json() : {};
        if (Array.isArray(body.platforms)) slugs = slugsFromNames(body.platforms);
      } catch {
        // A failed read counts as nothing saved; the route still settles Where itself.
      }
      if (latest.current === id) setFetched({ userId, slugs });
    })();
  }, [userId]);

  const saved = userId && fetched?.userId === userId ? fetched.slugs : [];

  const save = async (slugs: PlatformSlug[], toProfile: boolean) => {
    if (!toProfile || !userId) {
      writeDeviceServices(slugs);
      return;
    }
    const platforms = platformsFor(slugs).map((p) => p.name);
    const res = await fetch("/api/streaming-preferences", {
      method: "PUT",
      headers: await getAuthHeaders(),
      body: JSON.stringify({ platforms }),
    });
    if (!res.ok) throw new Error("Couldn't save your services");
    // Only on success: a failed save leaves a pending read to answer.
    latest.current++;
    setFetched({ userId, slugs: slugsFromNames(platforms) });
  };

  return {
    list: saved.length > 0 ? saved : device,
    saved: saved.length > 0,
    signedIn: userId !== null,
    loading: userId !== null && fetched?.userId !== userId,
    save,
  };
}
