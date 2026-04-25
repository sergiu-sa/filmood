"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Film } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/tmdb";

export default function HeroNowShowing() {
  const [films, setFilms] = useState<Film[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/movies/trending")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setFilms((data.films ?? []).slice(0, 3));
      })
      .catch(() => {
        /* silent — "Now showing" label stays, no items */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 180, maxWidth: 220 }}>
      {/* Editorial label */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 8,
          fontSize: 9.5, letterSpacing: 1.8, textTransform: "uppercase",
          color: "var(--t3)", fontWeight: 600,
          marginBottom: 2,
        }}
      >
        <span>Now showing</span>
        <span aria-hidden style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      {films.map((f) => {
        const year = f.release_date ? f.release_date.slice(0, 4) : "";
        return (
          <Link
            key={f.id}
            href={`/film/${f.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "6px 6px", margin: "0 -6px",
              borderRadius: 6,
              textDecoration: "none",
              transition: "background 0.18s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            onFocus={(e) => (e.currentTarget.style.background = "var(--surface2)")}
            onBlur={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <span
              aria-hidden
              style={{
                width: 44, aspectRatio: "2 / 3", borderRadius: 3,
                backgroundImage: f.poster_path ? `url(${tmdbImageUrl(f.poster_path, "w154")})` : "none",
                backgroundColor: "var(--surface2)",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
                border: "1px solid var(--border)",
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontFamily: "var(--font-serif), Georgia, serif",
                  fontSize: 12.5, fontWeight: 600, color: "var(--t1)",
                  lineHeight: 1.2,
                  overflow: "hidden", textOverflow: "ellipsis",
                  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                }}
              >
                {f.title}
              </div>
              {year && (
                <div style={{ fontSize: 10.5, color: "var(--t3)", marginTop: 2, letterSpacing: 0.3 }}>
                  {year}
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
