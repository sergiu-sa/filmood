"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import FilmCard from "@/components/film/FilmCard";
import TopPick from "@/components/results/TopPick";
import ResultsNotice from "@/components/results/ResultsNotice";
import FilterBar from "@/components/results/FilterBar";
import MoodHeader from "@/components/results/MoodHeader";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { AccentColor, DiscoverResponse, Provider } from "@/lib/types";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import { newSeed, parseSeed } from "@/lib/seededRandom";
import { pickTopFilm } from "@/lib/topPick";
import { ANY_LABELS, clearFilterParam, type FilterKey } from "@/lib/moodFilters";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { discoverQuery } from "@/lib/discoverQuery";
import { filmCount } from "@/lib/filmCount";
import { useDeviceServices } from "@/lib/useServices";

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

const noSubscribe = () => () => {};

/* ── Results content ── */
function ResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mood = searchParams.get("mood");
  const text = searchParams.get("text");
  const seed = parseSeed(searchParams.get("seed"));
  const src = searchParams.get("src");
  const deviceServices = useDeviceServices();
  // Hydrating, the device's services read as none. A query built then would
  // fetch, and fetch again once they're read.
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false);
  const query = hydrated ? discoverQuery(searchParams, deviceServices) : null;

  // What's on screen and what failed, each with the query it answers, so
  // "busy" is derived from the URL instead of being set in the effect.
  const [shown, setShown] = useState<{ query: string; data: DiscoverResponse } | null>(null);
  const [failed, setFailed] = useState<{ query: string; message: string } | null>(null);
  const busy = shown !== null && shown.query !== query && failed?.query !== query;
  const [providers, setProviders] = useState<Provider[] | null>(null);
  const [providersLoading, setProvidersLoading] = useState(false);
  const fetchedQuery = useRef<string | null>(null);

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
    if (!mood && !text) return;

    // The seed goes into the URL before the first fetch, so Back to this page
    // restores the same list. The replace re-runs this effect, which fetches once.
    if (!seed) {
      const withSeed = new URLSearchParams(searchParams.toString());
      withSeed.set("seed", String(newSeed()));
      router.replace(`/results?${withSeed}`, { scroll: false });
      return;
    }

    // Dropping src below re-runs this effect with the same query; don't fetch
    // (and log the search) twice.
    if (!query || query === fetchedQuery.current) return;
    fetchedQuery.current = query;
    const params = new URLSearchParams(query);
    if (src) params.set("src", src);

    const fetchFilms = async () => {
      try {
        // Signed in, discover reads saved services for where=mine and records mood history.
        const res = await fetch(`/api/movies/discover?${params}`, {
          headers: await getAuthHeaders(),
        });
        const data: DiscoverResponse & { error?: string } = await res.json();
        // Superseded (a related mood, then Back). The guard above skips re-runs,
        // so an effect cleanup flag could leave nothing fetching.
        if (fetchedQuery.current !== query) return;

        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to load films");
        }
        setShown({ query, data });
      } catch (err) {
        if (fetchedQuery.current === query) {
          setFailed({ query, message: err instanceof Error ? err.message : "Failed to load films" });
        }
      }
    };

    fetchFilms();

    // src credits this one search in search_events. Left in the URL, Back and
    // reload would credit it again.
    if (src) {
      const withoutSrc = new URLSearchParams(searchParams.toString());
      withoutSrc.delete("src");
      router.replace(`/results?${withoutSrc}`, { scroll: false });
    }
  }, [mood, text, seed, src, query, router, searchParams]);

  const films = shown?.data.films ?? [];
  // The server's list: retired keys resolved, text moods added, capped at two.
  const moods = shown?.data.moods.map((m) => m.key) ?? [];

  // Fetch providers for the top pick
  const topPick = pickTopFilm(films);

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

  const removeFilter = (key: FilterKey) => {
    const next = clearFilterParam(searchParams, key);
    next.set("src", "suggestion");
    router.replace(`/results?${next}`, { scroll: false });
  };

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

  if (failed && failed.query === query) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-4"
        style={{ minHeight: "60vh" }}
      >
        {/* The mood header isn't rendered here, so the message is the page's heading. */}
        <h1 style={{ fontSize: "14px", color: "var(--rose)" }}>{failed.message}</h1>
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

  if (!shown) {
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

  const { accent: accentKey } = getMeta(moods);
  const accent = ACCENT_VARS[accentKey];
  const restFilms = topPick ? films.filter((f) => f.id !== topPick.id) : films;

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "What to watch" },
          ]}
        />
      </div>

      <MoodHeader
        moods={shown.data.moods}
        interpreted={shown.data.interpreted}
        droppedMoods={shown.data.droppedMoods}
        filters={shown.data.filters}
      />

      <FilterBar filters={shown.data.filters} count={films.length} busy={busy} />

      {/* The last answer stays on screen, dimmed, until the new one arrives. */}
      <div
        aria-busy={busy}
        style={{
          width: "100%",
          marginTop: "24px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: busy ? 0.5 : 1,
          pointerEvents: busy ? "none" : undefined,
          transition: "opacity 0.2s ease",
        }}
      >
        <ResultsNotice
          count={films.length}
          suggestions={shown.data.suggestions}
          relatedMoods={shown.data.relatedMoods}
          relaxed={shown.data.relaxed}
          partial={shown.data.partial}
          labels={ANY_LABELS}
          onRemove={removeFilter}
        />

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
                {filmCount(restFilms.length)}
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

      </div>

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
        // clip, not hidden: hidden makes a scroll container, which stops the filter bar sticking.
        overflow: "clip",
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
          boxSizing: "border-box",
          overflowX: "clip",
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
