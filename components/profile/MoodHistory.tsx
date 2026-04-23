"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import type { AccentColor } from "@/lib/types";

interface Entry {
  mood: string;
  count: number;
}

const SKELETON_ROWS = 5;

function labelFor(moodKey: string): string {
  // moodMap labels are long tag lines ("Need to laugh"); the sidebar has tight
  // width so we use the key capitalized. Covers all 15 moods readably.
  return moodKey.charAt(0).toUpperCase() + moodKey.slice(1);
}

function colorFor(moodKey: string): string {
  const accent = (moodMap[moodKey]?.accentColor ?? "gold") as AccentColor;
  return ACCENT_VARS[accent].base;
}

export default function MoodHistory() {
  const { user } = useAuth();
  // null = still loading; array = fetched (possibly empty)
  const [entries, setEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    if (!user) {
      setEntries([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/mood-history", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load mood history");
        const data = await res.json();
        if (!cancelled) setEntries((data.top ?? []) as Entry[]);
      } catch {
        // Silent degrade to empty state — one failed sidebar shouldn't
        // block the rest of the profile page.
        if (!cancelled) setEntries([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = entries === null;
  const list = entries ?? [];
  const maxCount = list[0]?.count ?? 0;

  return (
    <div className="mb-4 rounded-2xl border border-(--border) bg-(--surface) p-5.5">
      <div className="mb-4 text-[10px] font-semibold uppercase tracking-[1.8px] text-(--t3)">
        Mood history
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="search-skeleton-bar h-3 w-22.5 shrink-0 rounded-sm"
              />
              <div className="search-skeleton-bar h-1.5 flex-1 rounded-full" />
              <div className="search-skeleton-bar h-3 w-7 rounded-sm" />
            </div>
          ))}
        </div>
      ) : list.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {list.map(({ mood, count }) => {
            const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
            return (
              <div key={mood} className="flex items-center gap-2.5">
                <span className="w-22.5 shrink-0 text-xs font-medium text-(--t2) capitalize">
                  {labelFor(mood)}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--surface2)">
                  <div
                    className="h-full rounded-full transition-[width] duration-500 ease-out"
                    style={{ width: `${pct}%`, background: colorFor(mood) }}
                  />
                </div>
                <span className="w-7 text-right text-[11px] font-medium text-(--t3)">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="mb-1 text-[13px] text-(--t2)">No mood picks yet</p>
          <p className="text-[11px] text-(--t3)">
            Your most-used moods will show up here
          </p>
        </div>
      )}
    </div>
  );
}
