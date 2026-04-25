"use client";

import { useState, useEffect } from "react";
import { tmdbImageUrl } from "@/lib/tmdb";

// Fallback backdrop used while trending data is in flight (or if the request
// fails). A real TMDB poster keeps the auth screens from flashing a blank
// frame on first paint.
const FALLBACK_BACKDROP =
  tmdbImageUrl("/wabiQjakDFOPGyGZo5h83Bbtqv2.jpg", "original")!;

/**
 * Rotates through trending-film backdrops behind the auth screens. Fetches
 * once on mount; cross-fades every 6s with an 800ms fade window. Falls back
 * to a single static backdrop if the fetch fails or returns nothing usable.
 */
export function useDynamicBackdrop() {
  const [backdrops, setBackdrops] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [nextIndex, setNextIndex] = useState(1);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    fetch("/api/movies/trending")
      .then((r) => r.json())
      .then((data) => {
        const urls: string[] = (data.results ?? data.films ?? data ?? [])
          .filter((m: { backdrop_path?: string }) => m.backdrop_path)
          .slice(0, 10)
          .map((m: { backdrop_path: string }) =>
            tmdbImageUrl(m.backdrop_path, "original"),
          )
          .filter((u: string | null): u is string => u !== null);
        if (urls.length > 0) setBackdrops(urls);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (backdrops.length < 2) return;
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % backdrops.length);
        setNextIndex((prev) => (prev + 1) % backdrops.length);
        setFading(false);
      }, 800);
    }, 6000);
    return () => clearInterval(interval);
  }, [backdrops]);

  return {
    current: backdrops[currentIndex] ?? FALLBACK_BACKDROP,
    next: backdrops[nextIndex] ?? null,
    fading,
  };
}
