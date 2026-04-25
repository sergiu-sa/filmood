"use client";

import { moodMap } from "@/lib/moodMap";
import { tmdbImageUrl } from "@/lib/tmdb";

interface HeroFeatureFilmProps {
  moodKey: string;
}

export default function HeroFeatureFilm({ moodKey }: HeroFeatureFilmProps) {
  const mood = moodMap[moodKey];
  const film = mood?.signatureFilm;

  if (!film) {
    return (
      <div
        role="img"
        aria-label="Poster unavailable — mood not found"
        style={{
          width: 240, aspectRatio: "2 / 3", borderRadius: 8,
          background: "var(--surface2)", border: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--t3)", fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase",
        }}
      >
        Coming soon
      </div>
    );
  }

  const posterUrl = tmdbImageUrl(film.posterPath, "w342");

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        key={moodKey}
        className="hero-feature-poster"
        style={{
          position: "relative",
          width: 240, aspectRatio: "2 / 3",
          borderRadius: 8, overflow: "hidden",
          background: "linear-gradient(135deg, var(--surface2) 0%, var(--surface) 100%)",
          border: "1px solid rgba(var(--gold-rgb), 0.18)",
          boxShadow: "0 24px 60px var(--overlay-heavy)",
          transform: "rotate(-2.5deg)",
          transformOrigin: "center bottom",
        }}
      >
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signature films map is static; next/image overhead not warranted for this leaf component
          <img
            src={posterUrl}
            alt={`${film.title} — ${moodKey} pick for tonight`}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            role="img"
            aria-label={`${film.title} (${film.year}) — ${moodKey} pick`}
            style={{
              width: "100%", height: "100%",
              background: "radial-gradient(circle at 30% 20%, rgba(var(--gold-rgb), 0.28), transparent 60%)",
            }}
          />
        )}

        {/* Year — top-left */}
        <span
          style={{
            position: "absolute", top: 9, left: 11,
            fontSize: 10, color: "var(--t2)",
            letterSpacing: 1.5, fontWeight: 500,
            textShadow: "0 1px 2px var(--overlay-heavy)",
          }}
        >
          {film.year}
        </span>

        {/* MOOD MATCH badge — top-right */}
        <span
          style={{
            position: "absolute", top: 9, right: 11,
            background: "var(--overlay-heavy)", backdropFilter: "blur(6px)",
            border: "1px solid rgba(var(--gold-rgb), 0.35)",
            padding: "4px 8px", borderRadius: 999,
            fontSize: 9, fontWeight: 600, letterSpacing: 0.8,
            color: "var(--gold)",
          }}
        >
          ◉ MOOD MATCH
        </span>

        {/* Title — bottom overlay */}
        <div
          style={{
            position: "absolute", bottom: 0, left: 0, right: 0,
            padding: "18px 12px 10px",
            background: "linear-gradient(to top, var(--overlay-heavy), transparent)",
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: 12, fontWeight: 600, color: "var(--accent-paper)", lineHeight: 1.2,
          }}
        >
          {film.title}
        </div>
      </div>

      {/* Outer frame — editorial border */}
      <div
        aria-hidden
        style={{
          position: "absolute", inset: -6,
          border: "1px solid rgba(var(--gold-rgb), 0.2)",
          borderRadius: 12, pointerEvents: "none",
        }}
      />
    </div>
  );
}
