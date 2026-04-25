"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";

interface FilmActionsProps {
  movieId: number;
  movieTitle: string;
  posterPath: string | null;
  /** Layout variant — desktop renders a horizontal row, mobile stacks. */
  layout: "row" | "column";
}

type WatchlistEntry = { movie_id: number };

export default function FilmActions({
  movieId,
  movieTitle,
  posterPath,
  layout,
}: FilmActionsProps) {
  const { user, loading: authLoading } = useAuth();
  const [inWatchlist, setInWatchlist] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  // Avoids the flash where a saved film shows the unsaved heart on first paint.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setInWatchlist(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/watchlist", { headers });
        if (!res.ok) {
          if (!cancelled) setInWatchlist(false);
          return;
        }
        const data = await res.json();
        const list = (data.watchlist ?? []) as WatchlistEntry[];
        if (!cancelled) setInWatchlist(list.some((e) => e.movie_id === movieId));
      } catch {
        if (!cancelled) setInWatchlist(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, movieId]);

  async function toggleWatchlist() {
    if (!user || busy || inWatchlist === null) return;
    const previous = inWatchlist;
    setBusy(true);
    setInWatchlist(!previous);
    try {
      const headers = await getAuthHeaders();
      if (previous) {
        const res = await fetch("/api/watchlist/remove", {
          method: "DELETE",
          headers,
          body: JSON.stringify({ movie_id: movieId }),
        });
        if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
      } else {
        const res = await fetch("/api/watchlist/add", {
          method: "POST",
          headers,
          body: JSON.stringify({
            movie_id: movieId,
            movie_title: movieTitle,
            poster_path: posterPath,
          }),
        });
        // 409 = already saved server-side; treat as success and keep saved=true.
        if (!res.ok && res.status !== 409) {
          throw new Error(`Add failed: ${res.status}`);
        }
      }
    } catch (err) {
      console.error("watchlist toggle failed", err);
      setInWatchlist(previous);
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: movieTitle, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Secure context unavailable (e.g. http) — silently no-op.
    }
  }

  const containerStyle: React.CSSProperties =
    layout === "row"
      ? { display: "flex", gap: "8px", marginTop: "16px" }
      : { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" };

  const buttonStyle: React.CSSProperties =
    layout === "row" ? { flex: 1 } : { width: "100%" };

  if (!authLoading && !user) {
    return (
      <div className="fd-actions" style={containerStyle}>
        <Link
          href="/login"
          className="fd-btn"
          style={{ ...buttonStyle, textDecoration: "none" }}
          aria-label="Sign in to save to your watchlist"
        >
          ♡ Sign in to save
        </Link>
        <button
          className="fd-btn"
          style={buttonStyle}
          onClick={handleShare}
          aria-label="Share this film"
        >
          {shareCopied ? "✓ Copied!" : "↗ Share"}
        </button>
      </div>
    );
  }

  const watchlistDisabled = authLoading || inWatchlist === null || busy;
  const heart = inWatchlist ? "♥" : "♡";
  const watchlistLabel = inWatchlist ? "Saved" : "Watchlist";

  return (
    <div className="fd-actions" style={containerStyle}>
      <button
        className="fd-btn"
        style={{
          ...buttonStyle,
          opacity: watchlistDisabled ? 0.6 : 1,
          cursor: watchlistDisabled ? "default" : "pointer",
        }}
        onClick={toggleWatchlist}
        disabled={watchlistDisabled}
        aria-pressed={!!inWatchlist}
        aria-label={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      >
        {heart} {watchlistLabel}
      </button>
      <button
        className="fd-btn"
        style={buttonStyle}
        onClick={handleShare}
        aria-label="Share this film"
      >
        {shareCopied ? "✓ Copied!" : "↗ Share"}
      </button>
    </div>
  );
}
