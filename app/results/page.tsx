"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useRef, useSyncExternalStore, Suspense } from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { ResultsTopPick } from "@/components/results/TopPick";
import ResultsNotice from "@/components/results/ResultsNotice";
import ResultsGrid from "@/components/results/ResultsGrid";
import { ResultsError, ResultsLoading } from "@/components/results/ResultsStatus";
import FilterBar from "@/components/results/FilterBar";
import MoodHeader from "@/components/results/MoodHeader";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { DiscoverResponse } from "@/lib/types";
import { newSeed, parseSeed } from "@/lib/seededRandom";
import { pickTopFilm } from "@/lib/topPick";
import { ANY_LABELS, clearFilterParam, type FilterKey } from "@/lib/moodFilters";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { discoverQuery } from "@/lib/discoverQuery";
import { useDeviceServices } from "@/lib/useServices";

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
  const [failed, setFailed] = useState<{ query: string; message: string; retryable: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const busy = shown !== null && shown.query !== query && failed?.query !== query;
  const fetchedQuery = useRef<string | null>(null);

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
    // (and log the search) twice. Try again clears the guard.
    if (!query || query === fetchedQuery.current) return;
    fetchedQuery.current = query;
    const params = new URLSearchParams(query);
    if (src) params.set("src", src);

    const fetchFilms = async () => {
      let failure = { message: "Failed to load films", retryable: true };
      try {
        // Signed in, discover reads saved services for where=mine and records mood history.
        const res = await fetch(`/api/movies/discover?${params}`, {
          headers: await getAuthHeaders(),
        });
        const data: DiscoverResponse & { error?: string } = await res.json();
        // Superseded (a related mood, then Back). The guard above skips re-runs,
        // so an effect cleanup flag could leave nothing fetching.
        if (fetchedQuery.current !== query) return;

        if (res.ok && !data.error) {
          setShown({ query, data });
          return;
        }
        // A 4xx describes the request (text with no mood word); retrying can't change it.
        failure = { message: data.error || failure.message, retryable: !(res.status >= 400 && res.status < 500) };
      } catch {
        // No answer, or a 5xx that isn't JSON: the default failure, retryable.
      }
      if (fetchedQuery.current === query) setFailed({ query, ...failure });
    };

    fetchFilms();

    // src credits this one search in search_events. Left in the URL, Back and
    // reload would credit it again.
    if (src) {
      const withoutSrc = new URLSearchParams(searchParams.toString());
      withoutSrc.delete("src");
      router.replace(`/results?${withoutSrc}`, { scroll: false });
    }
  }, [mood, text, seed, src, query, router, searchParams, attempt]);

  const retry = () => {
    fetchedQuery.current = null;
    setFailed(null);
    setAttempt((n) => n + 1);
  };

  const films = shown?.data.films ?? [];
  // The server's list: retired keys resolved, text moods added, capped at two.
  const moods = shown?.data.moods ?? [];
  // A blend has no top pick: its rows lead with the films that fit both moods.
  const topPick = moods.length === 1 ? pickTopFilm(films) : null;

  const removeFilter = (key: FilterKey) => {
    const next = clearFilterParam(searchParams, key);
    next.set("src", "suggestion");
    router.replace(`/results?${next}`, { scroll: false });
  };

  if (!mood && !text) return <ResultsError message="No mood selected." retryable={false} onRetry={retry} />;

  if (failed && failed.query === query) {
    return <ResultsError message={failed.message} retryable={failed.retryable} onRetry={retry} />;
  }

  if (!shown) return <ResultsLoading />;

  const { data } = shown;
  const restFilms = topPick ? films.filter((f) => f.id !== topPick.id) : films;

  return (
    <>
      <div style={{ marginBottom: "20px" }}>
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "What to watch" }]} />
      </div>

      <MoodHeader moods={moods} interpreted={data.interpreted} droppedMoods={data.droppedMoods} filters={data.filters} busy={busy} />

      <FilterBar filters={data.filters} count={films.length} busy={busy} />

      {/* The last answer stays on screen, dimmed, until the new one arrives. */}
      <div
        aria-busy={busy}
        style={{
          display: "flex",
          flexDirection: "column",
          marginTop: "24px",
          opacity: busy ? 0.5 : 1,
          pointerEvents: busy ? "none" : undefined,
          transition: "opacity 0.2s ease",
        }}
      >
        <ResultsNotice
          count={films.length}
          moods={moods}
          filters={data.filters}
          suggestions={data.suggestions}
          relatedMoods={data.relatedMoods}
          relaxed={data.relaxed}
          partial={data.partial}
          labels={ANY_LABELS}
          onRemove={removeFilter}
        />

        {topPick && <ResultsTopPick key={topPick.id} film={topPick} mood={moods[0]} />}

        <ResultsGrid films={restFilms} moods={moods} />
      </div>

      <div style={{ display: "flex", justifyContent: "center", marginTop: "48px", paddingTop: "28px", borderTop: "1px solid var(--border)" }}>
        <Link
          href="/browse"
          className="font-sans"
          style={{
            padding: "12px 28px",
            borderRadius: "10px",
            color: "var(--t1)",
            fontSize: "13px",
            fontWeight: 600,
            textDecoration: "none",
            textTransform: "uppercase",
            letterSpacing: "1px",
            border: "1px solid var(--border-h)",
            transition: "all 0.25s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-active)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-h)")}
        >
          Browse all films
        </Link>
      </div>
    </>
  );
}

const glow = {
  position: "fixed",
  top: "-120px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "600px",
  height: "400px",
  borderRadius: "50%",
  background: "radial-gradient(ellipse, var(--gold-glow) 0%, transparent 70%)",
  opacity: 0.5,
  pointerEvents: "none",
  zIndex: 0,
} as const;

/* ── Page ── */
export default function ResultsPage() {
  const isNarrow = useMediaQuery("(max-width: 740px)");
  const isPhone = useMediaQuery("(max-width: 480px)");
  const wrapperPadding = isPhone ? "32px 12px 40px" : isNarrow ? "48px 16px 60px" : "48px 28px 60px";

  return (
    // clip, not hidden: hidden makes a scroll container, which stops the filter bar sticking.
    <main style={{ minHeight: "100vh", background: "var(--bg)", position: "relative", overflow: "clip" }}>
      {/* Ambient glow */}
      <div aria-hidden="true" style={glow} />

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
        <Suspense fallback={<ResultsLoading label="Loading..." />}>
          <ResultsContent />
        </Suspense>
      </div>
    </main>
  );
}
