"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { useAuth } from "@/components/AuthProvider";
import FilmCard from "@/components/film/FilmCard";
import Icon from "@/components/ui/Icon";
import { filmCount } from "@/lib/filmCount";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { useMediaQuery } from "@/lib/useMediaQuery";

interface WatchlistFilm {
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  release_date: string | null;
  vote_average: number | null;
}

const action = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: "44px",
  boxSizing: "border-box",
  padding: "0 22px",
  borderRadius: "12px",
  fontSize: "14px",
  fontWeight: 600,
  textDecoration: "none",
} as const;
const primary = { ...action, border: "none", background: "var(--gold)", color: "var(--gold-on)", fontWeight: 700 } as const;
const secondary = { ...action, border: "1px solid var(--border-h)", color: "var(--t1)" } as const;

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  // Keyed on the id: a token refresh hands out a new user object and must not refetch.
  const userId = user?.id;
  const [list, setList] = useState<{ userId: string; rows: WatchlistFilm[] | null } | null>(null);
  // Hidden, not spliced out, so a failed remove puts the card back in its place.
  const [removed, setRemoved] = useState<ReadonlySet<number>>(new Set());
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const cards = useRef<HTMLUListElement>(null);

  // ResultsGrid's breakpoints, so the cards look the same as on /results.
  const isSmall = useMediaQuery("(max-width: 440px)");
  const isMedium = useMediaQuery("(max-width: 740px)");
  const isTablet = useMediaQuery("(max-width: 900px)");
  const isNarrowDesktop = useMediaQuery("(max-width: 1100px)");
  const columns = isSmall ? 1 : isMedium ? 2 : isTablet ? 3 : isNarrowDesktop ? 4 : 5;
  const grid = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: isTablet ? "12px" : "14px",
    width: "100%",
    maxWidth: isSmall ? "320px" : undefined,
    margin: isSmall ? "0 auto" : 0,
    padding: 0,
    listStyle: "none",
  } as const;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getAuthHeaders()
      .then((headers) => fetch("/api/watchlist?details=1", { headers }))
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { watchlist: WatchlistFilm[] } | null) => data?.watchlist ?? null)
      .catch(() => null)
      .then((rows) => {
        if (cancelled) return;
        setRemoved(new Set());
        setList({ userId, rows });
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  async function remove(film: WatchlistFilm, index: number) {
    setNotice("");
    // The button goes with its card. Once that has rendered, focus the Remove now in its slot
    // (the previous one after the last card, the heading when none is left).
    flushSync(() => setRemoved((ids) => new Set(ids).add(film.movie_id)));
    const buttons = cards.current?.querySelectorAll<HTMLButtonElement>("li > button");
    (buttons?.[index] ?? buttons?.[index - 1] ?? heading.current)?.focus();
    setNotice(`Removed ${film.movie_title}.`);
    try {
      const res = await fetch("/api/watchlist/remove", {
        method: "DELETE",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ movie_id: film.movie_id }),
      });
      if (!res.ok) throw new Error(`Remove failed: ${res.status}`);
    } catch {
      setRemoved((ids) => {
        const next = new Set(ids);
        next.delete(film.movie_id);
        return next;
      });
      setNotice(`Couldn't remove ${film.movie_title}.`);
    }
  }

  // undefined while loading, null when the load failed.
  const loaded = user && list?.userId === user.id ? list.rows : undefined;
  const shown = loaded && loaded.filter((film) => !removed.has(film.movie_id));

  let body: React.ReactNode;
  if (!authLoading && !user) {
    body = (
      <Message text="Log in to see your watchlist.">
        <Link href="/login" style={primary}>Log in</Link>
        <Link href="/signup" style={secondary}>Sign up</Link>
      </Message>
    );
  } else if (shown === undefined) {
    body = (
      <>
        <p className="sr-only">Loading your watchlist…</p>
        <div aria-hidden="true" style={grid}>
          {Array.from({ length: columns * 2 }, (_, i) => (
            <div key={i} className="search-skeleton-bar" style={{ aspectRatio: "2/3", borderRadius: "var(--r)" }} />
          ))}
        </div>
      </>
    );
  } else if (shown === null) {
    body = (
      <Message text="Couldn't load your watchlist.">
        <button
          type="button"
          onClick={() => {
            // The button is gone while the list reloads, which would drop focus to <body>.
            heading.current?.focus();
            setList(null);
            setAttempt((n) => n + 1);
          }}
          style={{ ...primary, font: "inherit", fontWeight: 700, cursor: "pointer" }}
        >
          Try again
        </button>
      </Message>
    );
  } else if (shown.length === 0) {
    body = (
      <Message text="Nothing saved yet.">
        <Link href="/" style={primary}>Pick a mood</Link>
        <Link href="/browse" style={secondary}>Browse films</Link>
      </Message>
    );
  } else {
    body = (
      // Safari drops a list's semantics under list-style: none.
      <ul ref={cards} role="list" style={grid}>
        {shown.map((film, i) => (
          <li key={film.movie_id} style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
            <FilmCard
              id={film.movie_id}
              title={film.movie_title}
              posterPath={film.poster_path}
              releaseDate={film.release_date}
              voteAverage={film.vote_average}
              overview=""
            />
            <button
              type="button"
              onClick={() => remove(film, i)}
              aria-label={`Remove ${film.movie_title}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                minHeight: "44px",
                border: "1px solid var(--border-h)",
                borderRadius: "var(--r)",
                background: "transparent",
                color: "var(--t2)",
                font: "inherit",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Icon name="trash" size={14} />
              Remove
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="font-sans" style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
          padding: isMedium ? "18px 16px 48px" : "18px 28px 60px",
          boxSizing: "border-box",
        }}
      >
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Watchlist" }]} />
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-serif"
          style={{ margin: "18px 0 0", fontSize: "28px", fontWeight: 600, lineHeight: 1.25, color: "var(--t1)", outline: "none" }}
        >
          My watchlist
          {shown && shown.length > 0 && (
            <span className="font-sans" style={{ fontSize: "15px", fontWeight: 500, color: "var(--t2)" }}>
              {" "}· {filmCount(shown.length)}
            </span>
          )}
        </h1>
        <p aria-live="polite" style={{ margin: "6px 0 0", fontSize: "13px", color: "var(--t2)" }}>
          {notice}
        </p>
        <div style={{ marginTop: "18px" }}>{body}</div>
      </div>
    </main>
  );
}

function Message({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "16px" }}>
      <p style={{ margin: 0, fontSize: "15px", color: "var(--t2)" }}>{text}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>{children}</div>
    </div>
  );
}
