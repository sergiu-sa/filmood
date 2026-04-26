"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import FilmCard from "@/components/film/FilmCard";
import TopPick from "@/components/results/TopPick";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { Film, AccentColor, Provider } from "@/lib/types";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";

function getMeta(moods: string[]) {
  const key = moods[0]?.trim().toLowerCase() ?? "";
  const mood = moodMap[key];

  return {
    accent: (mood?.accentColor ?? "gold") as AccentColor,
    tagline: mood?.description ?? "Films picked just for this moment.",
  };
}

/* TopPick lives in components/results/TopPick.tsx — pure presentational
   hero card for the solo-results "top match". This stub kept only as a
   marker; the implementation has moved out of this file. */

/* ── Results content ── */
function ResultsContent() {
  const searchParams = useSearchParams();
  const mood = searchParams.get("mood");
  const runtime = searchParams.get("runtime");
  const language = searchParams.get("language");
  const exclude = searchParams.get("exclude");
  const era = searchParams.get("era");
  const tempo = searchParams.get("tempo");
  const text = searchParams.get("text");

  const [films, setFilms] = useState<Film[]>([]);
  const [moods, setMoods] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);

  // Grid breakpoints via useMediaQuery (inline styles, not CSS classes)
  // to avoid Tailwind v4 layer conflicts in production
  const isSmall = useMediaQuery("(max-width: 440px)");
  const isMedium = useMediaQuery("(max-width: 740px)");
  const isTablet = useMediaQuery("(max-width: 900px)");
  const isNarrowDesktop = useMediaQuery("(max-width: 1100px)");

  const gridColumns = isSmall
    ? "1fr"
    : isMedium
      ? "repeat(2, 1fr)"
      : isTablet
        ? "repeat(3, 1fr)"
        : isNarrowDesktop
          ? "repeat(4, 1fr)"
          : "repeat(5, 1fr)";

  const gridGap = isSmall || isTablet ? "12px" : isMedium ? "10px" : "14px";

  useEffect(() => {
    // Text alone is enough to kick off a search — mood tiles are optional now.
    if (!mood && !text) {
      setLoading(false);
      return;
    }

    const parsedMoods = (mood ?? "")
      .split(",")
      .map((m) => m.trim().toLowerCase())
      .filter(Boolean);

    const fetchFilms = async () => {
      try {
        setLoading(true);
        setError(null);
        setMoods(parsedMoods);

        const params = new URLSearchParams();
        if (mood) params.set("mood", mood);
        if (runtime) params.set("runtime", runtime);
        if (language) params.set("language", language);
        if (exclude) params.set("exclude", exclude);
        if (era) params.set("era", era);
        if (tempo) params.set("tempo", tempo);
        if (text) params.set("text", text);

        const res = await fetch(`/api/movies/discover?${params.toString()}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to load films");
        }

        if (data.error) {
          throw new Error(data.error);
        }

        // Surface moods inferred from free-form text so the header pills still
        // show something meaningful when the user didn't pick a tile.
        if (Array.isArray(data.moods) && data.moods.length > 0 && parsedMoods.length === 0) {
          // data.mood is the resolved mood key list (comma-separated)
          const resolvedKeys = typeof data.mood === "string" ? data.mood.split(",") : [];
          setMoods(resolvedKeys);
        }

        setFilms(Array.isArray(data.films) ? data.films : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load films");
      } finally {
        setLoading(false);
      }
    };

    fetchFilms();
  }, [mood, runtime, language, exclude, era, tempo, text]);

  // Fetch providers for the top pick
  const topPick =
    films.length > 0
      ? films.reduce((best, f) =>
          (f.vote_average ?? 0) > (best.vote_average ?? 0) ? f : best,
        )
      : null;

  useEffect(() => {
    if (!topPick) return;

    let cancelled = false;
    setProvidersLoading(true);

    fetch(`/api/movies/${topPick.id}/providers`)
      .then((r) => r.json())
      .then((body) => {
        if (!cancelled) setProviders(body.providers ?? []);
      })
      .catch(() => {
        if (!cancelled) setProviders([]);
      })
      .finally(() => {
        if (!cancelled) setProvidersLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Only re-fetch when the top pick film ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topPick?.id]);

  if (!mood && !text) {
    return (
      <div className="text-center py-20">
        <p style={{ color: "var(--t2)" }} className="mb-4">
          No mood selected.
        </p>
        <Link
          href="/"
          style={{ color: "var(--t1)", textDecoration: "underline" }}
        >
          Pick a mood first
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ minHeight: "60vh" }}
      >
        <div
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "var(--gold)",
            animation: "breathe 2s ease-in-out infinite",
          }}
        />
        <p
          className="font-sans"
          style={{ fontSize: "13px", color: "var(--t3)", fontWeight: 500 }}
        >
          Finding films for your mood...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4"
        style={{ minHeight: "60vh" }}
      >
        <p style={{ fontSize: "14px", color: "var(--rose)" }}>{error}</p>
        <Link
          href="/"
          className="font-sans"
          style={{
            padding: "10px 24px",
            borderRadius: "var(--r)",
            background: "none",
            color: "var(--t2)",
            fontSize: "13px",
            fontWeight: 500,
            border: "1px solid var(--border)",
            textDecoration: "none",
          }}
        >
          Try different moods
        </Link>
      </div>
    );
  }

  const { accent: accentKey, tagline } = getMeta(moods);
  const accent = ACCENT_VARS[accentKey];
  const restFilms = topPick ? films.filter((f) => f.id !== topPick.id) : films;

  return (
    <>
      {/* ── Hero header ── */}
      <div style={{ textAlign: "center", marginBottom: "36px", width: "100%" }}>
        <div style={{ marginBottom: "16px" }}>
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Results" },
            ]}
          />
        </div>

        <div
          className="font-sans"
          style={{
            fontSize: "10px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "2.2px",
            color: accent.base,
            marginBottom: "12px",
          }}
        >
          {films.length} films found
        </div>

        <h1
          className="font-serif"
          style={{
            fontSize: "clamp(30px, 5vw, 44px)",
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.6px",
            color: "var(--t1)",
            marginBottom: "10px",
          }}
        >
          Your Matches
        </h1>

        <p
          className="font-sans"
          style={{
            fontSize: "13px",
            color: "var(--t2)",
            lineHeight: 1.6,
            maxWidth: "460px",
            margin: "0 auto 16px",
          }}
        >
          {tagline}
        </p>

        {/* Mood pills */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "6px",
          }}
        >
          {moods.map((m) => {
            const moodKey = m.trim().toLowerCase();
            const moodAccentKey = moodMap[moodKey]?.accentColor ?? "gold";
            const moodAccent = ACCENT_VARS[moodAccentKey];
            return (
              <span
                key={m}
                className="font-sans"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "5px 12px",
                  borderRadius: "999px",
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: moodAccent.base,
                  background: moodAccent.soft,
                  border: `1px solid ${moodAccent.soft}`,
                }}
              >
                {moodMap[moodKey]?.tagLabel ?? moodMap[moodKey]?.label ?? m}
              </span>
            );
          })}
        </div>
      </div>

      {/* ── Top pick ── */}
      {topPick && (
        <TopPick
          film={topPick}
          moods={moods}
          accent={accent}
          providers={providers}
          providersLoading={providersLoading}
        />
      )}

      {/* ── More matches ── */}
      {restFilms.length > 0 && (
        <div style={{ width: "100%", maxWidth: "1200px", boxSizing: "border-box" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: accent.base,
                flexShrink: 0,
              }}
            />
            <span
              className="font-sans"
              style={{
                fontSize: "13px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: "var(--t1)",
              }}
            >
              More matches
            </span>
            <span
              className="font-sans"
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "var(--t3)",
              }}
            >
              {restFilms.length} films
            </span>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: gridColumns,
              gap: gridGap,
              width: "100%",
              ...(isSmall ? { maxWidth: "320px", margin: "0 auto" } : {}),
            }}
          >
            {restFilms.map((film, i) => (
              <div
                key={film.id}
                style={{
                  animation: "fadeUp 0.4s ease both",
                  animationDelay: `${Math.min(i * 40, 500)}ms`,
                }}
              >
                <FilmCard
                  id={film.id}
                  title={film.title}
                  posterPath={film.poster_path}
                  releaseDate={film.release_date}
                  voteAverage={film.vote_average}
                  overview={film.overview}
                  accentBase={accent.base}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Footer actions ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          justifyContent: "center",
          marginTop: "48px",
          paddingTop: "28px",
          borderTop: "1px solid var(--border)",
          width: "100%",
          maxWidth: "1200px",
        }}
      >
        <Link
          href="/"
          className="font-sans"
          style={{
            padding: "12px 28px",
            borderRadius: "10px",
            background: accent.base,
            color: "var(--accent-ink)",
            fontSize: "13px",
            fontWeight: 700,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "1px",
            transition: "all 0.25s ease",
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
          Try different moods
        </Link>
        <Link
          href="/browse"
          className="font-sans"
          style={{
            padding: "12px 28px",
            borderRadius: "10px",
            background: "none",
            color: "var(--t1)",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "1px",
            border: "1px solid var(--border-h)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-active)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-h)";
          }}
        >
          Browse all films
        </Link>
      </div>

    </>
  );
}

/* ── Page ── */
export default function ResultsPage() {
  const isNarrow = useMediaQuery("(max-width: 740px)");
  const isPhone = useMediaQuery("(max-width: 480px)");

  const wrapperPadding = isPhone
    ? "32px 12px 40px"
    : isNarrow
      ? "48px 16px 60px"
      : "48px 28px 60px";

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: "-120px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "600px",
          height: "400px",
          borderRadius: "50%",
          background:
            "radial-gradient(ellipse, var(--gold-glow) 0%, transparent 70%)",
          opacity: 0.5,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: "1400px",
          width: "100%",
          margin: "0 auto",
          padding: wrapperPadding,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          overflowX: "hidden",
        }}
      >
        <Suspense
          fallback={
            <div
              className="flex flex-col items-center justify-center gap-3"
              style={{ minHeight: "60vh" }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: "var(--gold)",
                  animation: "breathe 2s ease-in-out infinite",
                }}
              />
              <p
                className="font-sans"
                style={{
                  fontSize: "13px",
                  color: "var(--t3)",
                  fontWeight: 500,
                }}
              >
                Loading...
              </p>
            </div>
          }
        >
          <ResultsContent />
        </Suspense>
      </div>
    </main>
  );
}
