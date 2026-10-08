"use client";

import { useEffect, useState, type Ref } from "react";
import Link from "next/link";
import CollapsedBoxRail from "./CollapsedBoxRail";

interface TrendingItem { id: number; title: string; genre_ids: number[] }

const GENRE_MAP: Record<number, string> = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 18: "Drama", 27: "Horror", 9648: "Mystery",
  10749: "Romance", 878: "Sci-Fi", 53: "Thriller",
};

interface TrendingBoxProps {
  onExpand: () => void;
  isExpanded?: boolean;
  isCollapsed?: boolean;
  /** The box, which takes focus back when the search panel's Close collapses it. */
  ref?: Ref<HTMLElement>;
}

export default function TrendingBox({ onExpand, isExpanded, isCollapsed, ref }: TrendingBoxProps) {
  const [items, setItems] = useState<TrendingItem[]>([]);

  useEffect(() => {
    fetch("/api/movies/trending")
      .then((r) => r.json())
      .then((data) => setItems((data.films ?? []).slice(0, 5)))
      .catch(() => setItems([]));
  }, []);

  if (isCollapsed) {
    return (
      <CollapsedBoxRail
        label="Trending"
        title="Trending today"
        sub="Top 5 films right now"
        accent="var(--blue)"
        accentSoft="var(--blue-soft)"
        ariaLabel="Trending today — top 5 films"
        onActivate={onExpand}
      />
    );
  }

  return (
    <section
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      aria-expanded={isExpanded}
      aria-label="Trending today"
      className="relative overflow-hidden cursor-pointer"
      style={{
        background: "var(--surface)",
        border: `1px solid ${isExpanded ? "var(--blue)" : "var(--border)"}`,
        borderRadius: 16, padding: 22,
        transition: "border-color 0.3s, box-shadow 0.3s",
        boxShadow: isExpanded ? "0 0 0 1px var(--blue), 0 0 16px var(--blue-glow)" : "none",
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 600, textTransform: "uppercase",
        letterSpacing: 1.8, color: "var(--blue)", marginBottom: 12,
      }}>
        Trending
      </div>

      <h2 className="font-serif" style={{
        fontSize: "clamp(20px, 2.2vw, 26px)", fontWeight: 600, color: "var(--t1)",
        lineHeight: 1.2, marginBottom: 6,
      }}>
        Trending today
      </h2>

      <p style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.5, marginBottom: 16 }}>
        Top 5 films right now.
      </p>

      <ol onClick={(e) => e.stopPropagation()} style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((f, i) => (
          <li key={f.id} style={{ marginBottom: 2 }}>
            <Link
              href={`/film/${f.id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center", gap: 10,
                padding: "7px 8px", margin: "0 -8px",
                borderRadius: 8, textDecoration: "none",
                transition: "background 0.18s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ color: "var(--t3)", fontSize: 12, fontVariantNumeric: "tabular-nums", minWidth: 20 }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: "var(--t1)", fontSize: 14, fontWeight: 500 }}>{f.title}</span>
              <span style={{ color: "var(--t3)", fontSize: 12 }}>
                {GENRE_MAP[f.genre_ids?.[0]] ?? "Film"}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
