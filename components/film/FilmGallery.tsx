"use client";

import { useState } from "react";
import type { MovieImage } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/tmdb";
import Lightbox from "./Lightbox";

interface FilmGalleryProps {
  posters: MovieImage[];
  backdrops: MovieImage[];
  movieTitle: string;
}

type Tab = "backdrops" | "posters";

export default function FilmGallery({
  posters,
  backdrops,
  movieTitle,
}: FilmGalleryProps) {
  const initialTab: Tab = backdrops.length > 0 ? "backdrops" : "posters";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [hoverHero, setHoverHero] = useState(false);

  const active = tab === "backdrops" ? backdrops : posters;
  const totalCount = posters.length + backdrops.length;

  if (totalCount === 0) return null;

  function openAt(idx: number) {
    setLightboxIndex(idx);
  }

  const hero = active[0];
  const rest = active.slice(1);
  const heroUrl = hero
    ? tmdbImageUrl(hero.file_path, hero.kind === "backdrop" ? "w1280" : "w780")
    : null;

  return (
    <div>
      {posters.length > 0 && backdrops.length > 0 && (
        <div
          role="tablist"
          aria-label="Gallery view"
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: "20px",
            marginBottom: "14px",
            paddingBottom: "10px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {(
            [
              { key: "backdrops" as const, label: "Backdrops", count: backdrops.length },
              { key: "posters" as const, label: "Posters", count: posters.length },
            ]
          ).map((t, i) => {
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.key)}
                style={{
                  position: "relative",
                  padding: "0 0 8px",
                  marginBottom: "-11px",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: "8px",
                  borderBottom: isActive
                    ? "2px solid var(--gold)"
                    : "2px solid transparent",
                  transition: "border-color 0.2s ease",
                  marginLeft: i === 0 ? 0 : 0,
                }}
              >
                <span
                  className="font-serif"
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: isActive ? "var(--t1)" : "var(--t3)",
                    letterSpacing: "-0.2px",
                    transition: "color 0.2s ease",
                  }}
                >
                  {t.label}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "1.4px",
                    color: isActive ? "var(--gold)" : "var(--t3)",
                    transition: "color 0.2s ease",
                  }}
                >
                  {String(t.count).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {hero && heroUrl && (
        <button
          onClick={() => openAt(0)}
          onMouseEnter={() => setHoverHero(true)}
          onMouseLeave={() => setHoverHero(false)}
          onFocus={() => setHoverHero(true)}
          onBlur={() => setHoverHero(false)}
          aria-label={`Open ${hero.kind} 1 of ${active.length} in lightbox`}
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            maxWidth: hero.kind === "poster" ? "320px" : "100%",
            margin: hero.kind === "poster" ? "0 auto 14px" : "0 0 14px",
            aspectRatio: hero.kind === "backdrop" ? "16/9" : "2/3",
            padding: 0,
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            borderRadius: "12px",
            overflow: "hidden",
            cursor: "pointer",
            boxShadow: hoverHero
              ? "0 16px 44px rgba(0,0,0,0.32)"
              : "0 6px 18px rgba(0,0,0,0.18)",
            transition: "box-shadow 0.25s ease",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroUrl}
            alt={`${movieTitle} ${hero.kind} 1`}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
              transform: hoverHero ? "scale(1.025)" : "scale(1)",
              transition: "transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)",
            }}
          />

          <span
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.55) 100%)",
              pointerEvents: "none",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: "14px",
              bottom: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "5px 10px",
              borderRadius: "100px",
              background: "rgba(8, 6, 14, 0.75)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.18)",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.92)",
              opacity: hoverHero ? 1 : 0.85,
              transform: hoverHero ? "translateY(-2px)" : "translateY(0)",
              transition: "opacity 0.2s ease, transform 0.2s ease",
            }}
          >
            <span aria-hidden style={{ fontSize: "11px" }}>
              ⤢
            </span>
            View larger
          </span>

          <span
            style={{
              position: "absolute",
              top: "12px",
              right: "14px",
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.8px",
              color: "rgba(255,255,255,0.78)",
              textTransform: "uppercase",
              textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            }}
            className="font-serif"
          >
            01 / {String(active.length).padStart(2, "0")}
          </span>
        </button>
      )}

      {rest.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "8px",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border) transparent",
          }}
        >
          {rest.map((img, i) => {
            const idx = i + 1;
            const thumbSize = img.kind === "backdrop" ? "w300" : "w185";
            const url = tmdbImageUrl(img.file_path, thumbSize);
            if (!url) return null;
            const thumbStyle: React.CSSProperties =
              img.kind === "backdrop"
                ? { width: "168px", aspectRatio: "16/9", flexShrink: 0 }
                : { width: "104px", aspectRatio: "2/3", flexShrink: 0 };
            return (
              <button
                key={`${img.file_path}-${idx}`}
                onClick={() => openAt(idx)}
                aria-label={`Open ${img.kind} ${idx + 1} of ${active.length}`}
                style={{
                  ...thumbStyle,
                  position: "relative",
                  padding: 0,
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  background: "var(--surface2)",
                  cursor: "pointer",
                  transition:
                    "border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gold-border)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow =
                    "0 8px 22px rgba(0,0,0,0.24)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${movieTitle} ${img.kind} ${idx + 1}`}
                  loading="lazy"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                <span
                  className="font-serif"
                  style={{
                    position: "absolute",
                    bottom: "4px",
                    left: "6px",
                    fontSize: "9.5px",
                    fontWeight: 700,
                    letterSpacing: "1.4px",
                    color: "rgba(255,255,255,0.85)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                  }}
                >
                  {String(idx + 1).padStart(2, "0")}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {lightboxIndex !== null && (
        <Lightbox
          images={active}
          initialIndex={lightboxIndex}
          movieTitle={movieTitle}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
