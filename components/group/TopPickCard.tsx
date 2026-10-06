"use client";

import Link from "next/link";
import type { MatchResult, Provider } from "@/lib/types";
import { moodMap, normalizeMoodKeys } from "@/lib/moodMap";
import { genreMap } from "@/lib/genres";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { ACCENT_VARS } from "@/lib/constants";
import VoteBreakdown from "./VoteBreakdown";
import { tmdbImageUrl } from "@/lib/tmdb";
import Icon from "@/components/ui/Icon";

interface TopPickCardProps {
  result: MatchResult;
  providers: Provider[] | null;
  providersLoading: boolean;
}

export default function TopPickCard({
  result,
  providers,
  providersLoading,
}: TopPickCardProps) {
  const isMobile = useMediaQuery("(max-width: 720px)");
  const { movie, tier, yesCount, maybeCount, noCount, votes } = result;

  const year = movie.release_date?.split("-")[0] || "";
  const rating = movie.vote_average?.toFixed(1) || "---";
  const posterUrl = tmdbImageUrl(movie.poster_path, "w500");

  // Normalising also dedupes: a deck built before two moods merged can tag
  // one film with both keys.
  const moodTags = normalizeMoodKeys(movie.mood_keys ?? []).map((k) => ({
    label: moodMap[k].tagLabel,
    accent: moodMap[k].accentColor,
  }));

  const genres = (movie.genre_ids ?? [])
    .map((id) => genreMap[id])
    .filter(Boolean)
    .slice(0, 4);

  const posterWidth = isMobile ? "100%" : "300px";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        maxWidth: "820px",
        margin: "0 auto",
      }}
    >
      {/* Gold glow aura sitting behind the card */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "-40px",
          background:
            "radial-gradient(ellipse at center, var(--gold-glow) 0%, transparent 60%)",
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
          border: "1px solid var(--gold)",
          borderRadius: "18px",
          overflow: "hidden",
          boxShadow:
            "0 20px 60px var(--overlay-scrim), 0 0 0 1px rgba(var(--gold-rgb), 0.15)",
          display: isMobile ? "flex" : "grid",
          flexDirection: "column",
          gridTemplateColumns: `${posterWidth} 1fr`,
        }}
      >
        {/* Poster */}
        <div
          role="img"
          aria-label={`${movie.title} poster`}
          style={{
            position: "relative",
            width: "100%",
            minHeight: isMobile ? "360px" : "450px",
            backgroundImage: posterUrl
              ? `url(${posterUrl})`
              : "linear-gradient(160deg, #1a1520, #2a1f35 30%, #0d1520)",
            backgroundSize: "cover",
            backgroundPosition: "center top",
          }}
        >
          {/* Tier badge — sits on the poster. The scrim is dark in both themes, so the badge takes dark mode's gold. */}
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
              color: "rgb(var(--gold-rgb))",
              border: "1px solid rgba(var(--gold-rgb), 0.4)",
            }}
          >
            {tier === "perfect" ? "★ Perfect Match" : "★ Top Pick"}
          </div>
        </div>

        {/* Info column */}
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
              {movie.title}
            </h2>
            <div
              className="font-sans"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "12px",
                color: "var(--t3)",
              }}
            >
              {year && <span>{year}</span>}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--gold-text)",
                  fontWeight: 700,
                }}
              >
                <Icon name="star-burst" size={11} />
                {rating}
              </span>
            </div>
          </div>

          {/* Mood + genre chips */}
          {(moodTags.length > 0 || genres.length > 0) && (
            <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
              {moodTags.map((tag) => {
                const vars = ACCENT_VARS[tag.accent as keyof typeof ACCENT_VARS] ?? ACCENT_VARS.gold;
                return (
                  <span
                    key={tag.label}
                    className="font-sans"
                    style={{
                      padding: "4px 10px",
                      borderRadius: "100px",
                      fontSize: "10px",
                      fontWeight: 600,
                      color: vars.text,
                      background: vars.soft,
                      border: `1px solid ${vars.border}`,
                    }}
                  >
                    {tag.label}
                  </span>
                );
              })}
              {genres.map((name) => (
                <span
                  key={name}
                  className="font-sans"
                  style={{
                    padding: "4px 10px",
                    borderRadius: "100px",
                    fontSize: "10px",
                    fontWeight: 500,
                    background: "var(--tag-bg)",
                    border: "1px solid var(--tag-border)",
                    color: "var(--t2)",
                  }}
                >
                  {name}
                </span>
              ))}
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
            {movie.overview}
          </p>

          {/* Vote summary */}
          <div
            style={{
              display: "flex",
              gap: "20px",
              padding: "12px 0",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {[
              { label: "Yes", count: yesCount, color: "var(--teal)" },
              { label: "Maybe", count: maybeCount, color: "var(--gold-text)" },
              { label: "No", count: noCount, color: "var(--rose)" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", flexDirection: "column" }}>
                <span
                  className="font-sans"
                  style={{
                    fontSize: "22px",
                    fontWeight: 800,
                    lineHeight: 1,
                    color: s.color,
                  }}
                >
                  {s.count}
                </span>
                <span
                  className="font-sans"
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "var(--t3)",
                    marginTop: "3px",
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Per-participant vote breakdown */}
          <VoteBreakdown votes={votes} variant="full" />

          {/* Streaming providers */}
          <div>
            <div
              className="font-sans"
              style={{
                fontSize: "9px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "var(--t3)",
                marginBottom: "8px",
              }}
            >
              Stream in Norway
            </div>
            {providersLoading ? (
              <div
                className="font-sans"
                style={{ fontSize: "11px", color: "var(--t3)" }}
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
                style={{ fontSize: "11px", color: "var(--t3)" }}
              >
                Not currently streaming in Norway
              </div>
            )}
          </div>

          {/* CTA */}
          <Link
            href={`/film/${movie.id}`}
            className="font-sans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px",
              padding: "14px 24px",
              borderRadius: "10px",
              background: "var(--gold)",
              color: "var(--gold-on)",
              fontSize: "13px",
              fontWeight: 700,
              textDecoration: "none",
              transition: "all 0.25s ease",
              textTransform: "uppercase",
              letterSpacing: "1px",
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
            Watch this →
          </Link>
        </div>
      </div>
    </div>
  );
}
