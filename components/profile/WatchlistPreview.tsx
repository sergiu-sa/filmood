"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { useAuth } from "@/components/AuthProvider";

interface WatchlistEntry {
  id: string;
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
}

const PREVIEW_COUNT = 4;

export default function WatchlistPreview() {
  const { user } = useAuth();
  // null = still loading; array = fetched (possibly empty)
  const [items, setItems] = useState<WatchlistEntry[] | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/watchlist", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load watchlist");
        const data = await res.json();
        if (!cancelled) setItems((data.watchlist ?? []) as WatchlistEntry[]);
      } catch {
        // Graceful degrade to the empty state — failure here shouldn't
        // block the rest of the profile page.
        if (!cancelled) setItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = items === null;
  const list = items ?? [];
  const preview = list.slice(0, PREVIEW_COUNT);
  const total = list.length;

  return (
    <div className="mb-4 rounded-2xl border border-(--border) bg-(--surface) p-5.5">
      <div className="mb-3.5 flex items-baseline justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-[1.8px] text-(--t3)">
          Watchlist
        </div>
        {!isLoading && total > 0 && (
          <div className="text-[11px] font-medium text-(--t3)">
            {total} saved
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-4 gap-2 mb-3.5">
          {Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
            <div
              key={i}
              className="search-skeleton-bar rounded-md"
              style={{ aspectRatio: "2/3" }}
            />
          ))}
        </div>
      ) : preview.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 mb-3.5">
          {preview.map((entry) => (
            <Link
              key={entry.id}
              href={`/film/${entry.movie_id}`}
              aria-label={entry.movie_title}
              className="group relative overflow-hidden rounded-md border border-(--border) transition-colors hover:border-(--border-h)"
              style={{ aspectRatio: "2/3", background: "var(--surface2)" }}
            >
              {entry.poster_path ? (
                <Image
                  src={`https://image.tmdb.org/t/p/w185${entry.poster_path}`}
                  alt={entry.movie_title}
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] text-(--t3)">
                  No poster
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center">
          <p className="mb-1 text-[13px] text-(--t2)">No films saved yet</p>
          <p className="text-[11px] text-(--t3)">
            Films you save will appear here
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-(--border) pt-3.5">
        <span className="text-xs text-(--t3)" />
        <Link
          href={total > 0 ? "/watchlist" : "/browse"}
          className="inline-flex items-center gap-1 rounded-lg border border-(--border) px-3.5 py-1.5 text-xs font-medium text-(--t2) no-underline transition-colors hover:border-(--border-h) hover:text-(--t1)"
        >
          {total > 0 ? "View all" : "Browse films"} →
        </Link>
      </div>
    </div>
  );
}
