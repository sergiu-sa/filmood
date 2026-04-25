"use client";

import Link from "next/link";
import { tmdbImageUrl } from "@/lib/tmdb";

interface GroupSession {
  code: string;
  waiting: number;
  status: string;
}

interface WatchlistItem {
  movie_id: number;
  title: string;
  poster_path: string | null;
}

interface HeroPersonalizedProps {
  groupSession: GroupSession | null;
  watchlistPeek: WatchlistItem[];
}

export default function HeroPersonalized({ groupSession, watchlistPeek }: HeroPersonalizedProps) {
  if (!groupSession && watchlistPeek.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 13, maxWidth: 320 }}>
      {groupSession && (
        <Link
          href={`/group/${groupSession.code}`}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "13px 14px", borderRadius: 12,
            background: "rgba(var(--teal-rgb), 0.08)",
            border: "1px solid rgba(var(--teal-rgb), 0.3)",
            textDecoration: "none",
            color: "var(--t1)",
          }}
        >
          <span
            aria-hidden
            style={{
              width: 9, height: 9, borderRadius: "50%",
              background: "var(--teal)",
              boxShadow: "0 0 10px var(--teal)",
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", marginBottom: 2 }}>
              Group · {groupSession.code}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              {groupSession.waiting} waiting to swipe
            </div>
          </div>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>live</span>
        </Link>
      )}

      {watchlistPeek.length > 0 && (
        <Link
          href="/watchlist"
          style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "11px 13px", borderRadius: 12,
            background: "var(--tag-bg)",
            border: "1px solid var(--border)",
            textDecoration: "none",
            color: "var(--t1)",
          }}
        >
          {watchlistPeek.slice(0, 3).map((f) => (
            <span
              key={f.movie_id}
              aria-hidden
              style={{
                width: 38, aspectRatio: "2 / 3", borderRadius: 4,
                backgroundImage: f.poster_path ? `url(${tmdbImageUrl(f.poster_path, "w154")})` : "none",
                backgroundColor: "var(--surface2)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            />
          ))}
          <div style={{ flex: 1, fontSize: 11.5, color: "var(--t2)", lineHeight: 1.4, minWidth: 0 }}>
            <strong style={{ color: "var(--t1)", fontWeight: 600 }}>Watchlist</strong>
            <br />
            {watchlistPeek.length} saved · <span style={{ color: "var(--gold)" }}>open →</span>
          </div>
        </Link>
      )}
    </div>
  );
}
