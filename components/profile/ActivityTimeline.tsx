"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import type { AccentColor } from "@/lib/types";

type EventKind = "watchlist" | "mood_pick" | "session_join" | "film_view";

interface TimelineEvent {
  id: string;
  at: string;
  kind: EventKind;
  data: {
    movie_id?: number;
    movie_title?: string;
    poster_path?: string | null;
    mood?: string;
    code?: string;
    status?: string;
    session_id?: string;
  };
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 14) return "Last week";
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function moodAccent(key: string): AccentColor {
  return (moodMap[key]?.accentColor ?? "gold") as AccentColor;
}

function moodLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

interface RowProps {
  event: TimelineEvent;
}

function Row({ event }: RowProps) {
  let accent: AccentColor = "gold";
  let body: React.ReactNode;

  switch (event.kind) {
    case "watchlist":
      accent = "gold";
      body = (
        <>
          Saved{" "}
          <FilmTitle
            id={event.data.movie_id}
            title={event.data.movie_title ?? "a film"}
          />{" "}
          to your watchlist.
        </>
      );
      break;
    case "mood_pick": {
      const mood = event.data.mood ?? "";
      accent = moodAccent(mood);
      body = (
        <>
          Picked{" "}
          <em
            className="font-serif"
            style={{
              fontStyle: "italic",
              fontWeight: 600,
              color: ACCENT_VARS[accent].base,
            }}
          >
            {moodLabel(mood)}
          </em>{" "}
          in a session.
        </>
      );
      break;
    }
    case "session_join":
      accent = "teal";
      body = (
        <>
          Joined group{" "}
          <Link
            href={`/group/${event.data.code}`}
            className="font-serif"
            style={{
              fontStyle: "italic",
              fontWeight: 600,
              color: "var(--teal)",
              textDecoration: "none",
              letterSpacing: "0.5px",
            }}
          >
            {event.data.code}
          </Link>
          .
        </>
      );
      break;
    case "film_view":
      accent = "violet";
      body = (
        <>
          Researched{" "}
          <FilmTitle
            id={event.data.movie_id}
            title={event.data.movie_title ?? "a film"}
          />
          .
        </>
      );
      break;
  }

  return (
    <div
      className="relative pb-5"
      style={{
        // CSS variable consumed by the ::before bullet styles below.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ["--accent" as any]: ACCENT_VARS[accent].base,
      }}
    >
      <span
        aria-hidden
        className="t-bullet"
        style={{
          position: "absolute",
          left: "-23px",
          top: "6px",
          width: "11px",
          height: "11px",
          borderRadius: "50%",
          background: ACCENT_VARS[accent].base,
          boxShadow: "0 0 0 3px var(--bg)",
        }}
      />
      <div
        style={{
          fontSize: "10px",
          fontWeight: 700,
          letterSpacing: "1.6px",
          textTransform: "uppercase",
          color: "var(--t3)",
          marginBottom: "4px",
        }}
      >
        {relativeTime(event.at)}
      </div>
      <div
        style={{
          fontSize: "13.5px",
          color: "var(--t1)",
          lineHeight: 1.5,
        }}
      >
        {body}
      </div>
    </div>
  );
}

function FilmTitle({
  id,
  title,
}: {
  id: number | undefined;
  title: string;
}) {
  if (typeof id !== "number") {
    return (
      <em className="font-serif" style={{ fontStyle: "italic", fontWeight: 600 }}>
        {title}
      </em>
    );
  }
  return (
    <Link
      href={`/film/${id}`}
      className="font-serif"
      style={{
        fontStyle: "italic",
        fontWeight: 600,
        color: "var(--t1)",
        textDecoration: "none",
        borderBottom: "1px dashed var(--border-h)",
      }}
    >
      {title}
    </Link>
  );
}

export default function ActivityTimeline() {
  const { user } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[] | null>(null);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/timeline", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load timeline");
        const data = await res.json();
        if (!cancelled) setEvents((data.events ?? []) as TimelineEvent[]);
      } catch {
        if (!cancelled) setEvents([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = events === null;
  const list = events ?? [];

  return (
    <article
      className="mb-4 rounded-2xl border p-5.5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="mb-4 flex items-baseline gap-3"
        style={{ borderColor: "var(--border)" }}
      >
        <h3
          className="font-serif"
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: "var(--t1)",
            margin: 0,
            letterSpacing: "-0.2px",
          }}
        >
          Recent activity
        </h3>
        <span
          aria-hidden
          className="flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(to right, var(--border) 0%, transparent 100%)",
          }}
        />
        <span
          className="hidden sm:inline"
          style={{
            fontSize: "10px",
            fontStyle: "italic",
            color: "var(--t3)",
          }}
        >
          From your watchlist, sessions, and views
        </span>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3 pl-7">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="search-skeleton-bar h-2.5 w-20 mb-1.5 rounded-sm" />
              <div className="search-skeleton-bar h-3.5 w-3/4 rounded-sm" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-6 text-center">
          <p
            style={{
              fontSize: "13px",
              color: "var(--t2)",
              margin: "0 0 4px",
            }}
          >
            Your timeline will fill up as you explore.
          </p>
          <p style={{ fontSize: "11px", color: "var(--t3)", margin: 0 }}>
            Save films, pick moods, join group sessions — they all show up here.
          </p>
        </div>
      ) : (
        <div
          className="relative pl-7"
          style={{
            // Vertical dotted rule.
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: "9px",
              top: "8px",
              bottom: "16px",
              width: "1px",
              background:
                "repeating-linear-gradient(to bottom, var(--border) 0 6px, transparent 6px 10px)",
            }}
          />
          {list.map((e) => (
            <Row key={e.id} event={e} />
          ))}
        </div>
      )}
    </article>
  );
}
