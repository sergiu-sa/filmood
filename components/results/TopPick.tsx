"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { AccentColor, DiscoverFilm, DiscoverResponse, Film, Keyword, Provider } from "@/lib/types";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import { tmdbImageUrl } from "@/lib/tmdb";
import { matchedKeywords, reasonGenres } from "@/lib/whyLine";
import Icon from "@/components/ui/Icon";

interface TopPickProps {
  film: Film;
  moods: string[];
  accent: AccentColor;
  providers: Provider[] | null;
  providersLoading: boolean;
  /** Mood keywords TMDB tagged the film with, and its genres, moods' own first. */
  why: { keywords: string[]; genres: string[] };
}

/**
 * Hero card for the solo-results page — the single film picked as the
 * "top match" for the user's mood query. Renders the poster + title +
 * rating + mood chips + overview + streaming providers + a CTA into
 * the film detail page. Pure presentational; receives all data via props.
 */
export default function TopPick({
  film,
  moods,
  accent: accentKey,
  providers,
  providersLoading,
  why,
}: TopPickProps) {
  const accent = ACCENT_VARS[accentKey];
  const isMobile = useMediaQuery("(max-width: 820px)");
  const year = film.release_date
    ? new Date(film.release_date).getFullYear()
    : "";
  const rating = film.vote_average?.toFixed(1) ?? "---";
  const posterUrl = film.poster_path
    ? tmdbImageUrl(film.poster_path, "w500")
    : null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "820px",
        margin: isMobile ? "0 0 28px" : "0 0 40px",
      }}
    >
      {/* Accent glow aura */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: isMobile ? "-20px" : "-40px",
          background: `radial-gradient(ellipse at center, ${accent.glow} 0%, transparent 60%)`,
          filter: "blur(40px)",
          opacity: 0.9,
          pointerEvents: "none",
          zIndex: 0,
          animation: "breathe 5s ease-in-out infinite",
        }}
      />

      {/* Card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "var(--surface)",
          border: `1px solid ${accent.base}`,
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow: `0 20px 60px var(--overlay-scrim), 0 0 0 1px ${accent.soft}`,
          display: isMobile ? "flex" : "grid",
          flexDirection: "column",
          gridTemplateColumns: isMobile ? "1fr" : "300px 1fr",
        }}
      >
        {/* Poster */}
        <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: isMobile ? "320px" : "450px",
            background: "var(--surface2)",
          }}
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={film.title}
              fill
              sizes="(max-width: 820px) 100vw, 300px"
              style={{ objectFit: "cover" }}
              priority
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--t3)",
                fontSize: "13px",
              }}
            >
              No Poster
            </div>
          )}

          {/* Badge */}
          {/* The scrim is dark in both themes, so the badge takes dark mode's accent. */}
          <div
            className="font-sans always-dark-accents"
            style={{
              position: "absolute",
              top: "16px",
              left: "16px",
              padding: "6px 12px",
              borderRadius: "100px",
              background: "var(--overlay-heavy)",
              backdropFilter: "blur(12px)",
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "1.8px",
              color: `rgb(var(--${accentKey}-rgb))`,
              border: `1px solid ${accent.soft}`,
            }}
          >
            ★ Top Match
          </div>
        </div>

        {/* Info */}
        <div
          style={{
            padding: isMobile ? "22px 22px 26px" : "34px 36px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          {/* Title + meta */}
          <div>
            <h2
              className="font-serif"
              style={{
                fontSize: isMobile ? "26px" : "34px",
                fontWeight: 600,
                lineHeight: 1.1,
                letterSpacing: "-0.5px",
                color: "var(--t1)",
                marginBottom: "8px",
              }}
            >
              {film.title}
            </h2>
            <div
              className="font-sans"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "13px",
                color: "var(--t2)",
              }}
            >
              {year && <span>{year}</span>}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: accent.text,
                  fontWeight: 700,
                }}
              >
                <Icon name="star-burst" size={11} />
                {rating}
              </span>
            </div>
          </div>

          {why.genres.length + why.keywords.length > 0 && (
            <p
              className="font-sans"
              style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "0 8px", margin: 0, fontSize: "13px", color: "var(--t2)" }}
            >
              <span
                style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "var(--gold-text)",
                }}
              >
                Why
              </span>
              <span>
                {why.keywords.length > 0 && (
                  <>
                    {"tagged "}
                    <em style={{ color: "var(--t1)" }}>{why.keywords.join(" · ")}</em>
                    {why.genres.length > 0 && " — "}
                  </>
                )}
                {why.genres.length > 0 && (
                  <>
                    <span style={{ color: "var(--t1)", fontWeight: 600 }}>{why.genres[0]}</span>
                    {why.genres.slice(1).map((g) => ` · ${g}`).join("")}
                  </>
                )}
              </span>
            </p>
          )}

          {/* Mood chips */}
          {moods.length > 0 && (
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {moods.map((m) => {
                const moodKey = m.trim().toLowerCase();
                const moodAccentKey = moodMap[moodKey]?.accentColor ?? "gold";
                const moodAccent = ACCENT_VARS[moodAccentKey];
                return (
                  <span
                    key={m}
                    className="font-sans"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "10px",
                      fontWeight: 600,
                      color: moodAccent.text,
                      background: moodAccent.soft,
                      border: `1px solid ${moodAccent.soft}`,
                    }}
                  >
                    {moodMap[moodKey]?.tagLabel ?? m}
                  </span>
                );
              })}
            </div>
          )}

          {/* Overview */}
          <p
            className="font-sans"
            style={{
              fontSize: "13px",
              lineHeight: 1.6,
              color: "var(--t2)",
              display: "-webkit-box",
              WebkitLineClamp: isMobile ? 4 : 5,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {film.overview}
          </p>

          {/* Streaming providers */}
          <div>
            <div
              className="font-sans"
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "var(--t2)",
                marginBottom: "8px",
              }}
            >
              Stream in Norway
            </div>
            {providersLoading ? (
              <div
                className="font-sans"
                style={{ fontSize: "11px", color: "var(--t2)" }}
              >
                Loading...
              </div>
            ) : providers && providers.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {providers.slice(0, 6).map((p) => (
                  <div
                    key={p.provider_id}
                    title={p.provider_name}
                    style={{
                      width: "38px",
                      height: "38px",
                      borderRadius: "8px",
                      overflow: "hidden",
                      background: "#fff",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tmdbImageUrl(p.logo_path, "w92") ?? ""}
                      alt={p.provider_name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="font-sans"
                style={{ fontSize: "11px", color: "var(--t2)" }}
              >
                Not currently streaming in Norway
              </div>
            )}
          </div>

          {/* CTA */}
          <Link
            href={`/film/${film.id}`}
            className="font-sans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px",
              padding: isMobile ? "12px 20px" : "14px 24px",
              borderRadius: "10px",
              background: accent.base,
              color: accent.on,
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.25s ease",
              textTransform: "uppercase",
              letterSpacing: "1px",
              width: isMobile ? "100%" : "auto",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.1)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "brightness(1)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            View details →
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * The results page's top pick: fetches the film's providers and keywords
 * (both cached 24 h) and builds its Why line. Key it by film id, so a new
 * pick starts empty instead of showing the last one's.
 */
export function ResultsTopPick({ film, mood }: { film: DiscoverFilm; mood: DiscoverResponse["moods"][number] }) {
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);

  useEffect(() => {
    let cancelled = false;
    // A failure reads as none: "Not currently streaming in Norway", or a Why of genres only.
    fetch(`/api/movies/${film.id}/providers`)
      .then((r) => r.json())
      .then((body) => !cancelled && setProviders(body.providers ?? []))
      .catch(() => !cancelled && setProviders([]));
    fetch(`/api/movies/${film.id}/keywords`)
      .then((r) => r.json())
      .then((body) => !cancelled && setKeywords(body.keywords ?? []))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [film.id]);

  return (
    <TopPick
      film={film}
      moods={[mood.key]}
      accent={mood.accent}
      providers={providers}
      providersLoading={providers === null}
      why={{
        keywords: matchedKeywords(keywords, film.moodKeys),
        genres: reasonGenres(film.genre_ids, film.moodKeys),
      }}
    />
  );
}
