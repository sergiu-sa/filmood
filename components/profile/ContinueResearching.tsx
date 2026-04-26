"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { tmdbImageUrl } from "@/lib/tmdb";

interface RecentFilm {
  movie_id: number;
  movie_title: string;
  poster_path: string | null;
  viewed_at: string;
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 3600) return "Just now";
  const h = Math.floor(s / 3600);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function ContinueResearching() {
  const { user } = useAuth();
  const [films, setFilms] = useState<RecentFilm[] | null>(null);

  useEffect(() => {
    if (!user) {
      setFilms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/film-views", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load views");
        const data = await res.json();
        if (!cancelled) setFilms((data.films ?? []) as RecentFilm[]);
      } catch {
        if (!cancelled) setFilms([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = films === null;
  const list = films ?? [];

  if (!isLoading && list.length === 0) return null;

  return (
    <article
      className="mb-4 rounded-2xl border p-5.5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="mb-3.5 flex items-baseline gap-3">
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
          Continue researching
        </h3>
        <span
          aria-hidden
          className="flex-1"
          style={{
            height: "1px",
            background:
              "linear-gradient(to right, var(--ember-border), transparent)",
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
          Films you opened but haven&apos;t saved
        </span>
      </div>

      {isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="search-skeleton-bar shrink-0"
              style={{
                width: "130px",
                aspectRatio: "2/3",
                borderRadius: "10px",
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto"
          style={{
            paddingBottom: "8px",
            scrollbarWidth: "thin",
            scrollbarColor: "var(--border) transparent",
          }}
        >
          {list.map((f) => {
            const url = tmdbImageUrl(f.poster_path, "w342");
            return (
              <Link
                key={f.movie_id}
                href={`/film/${f.movie_id}`}
                className="shrink-0 no-underline"
                style={{ width: "130px" }}
              >
                <div
                  className="relative overflow-hidden rounded-[10px] border"
                  style={{
                    width: "100%",
                    aspectRatio: "2/3",
                    background: "var(--surface2)",
                    borderColor: "var(--border)",
                    marginBottom: "6px",
                  }}
                >
                  {url ? (
                    <Image
                      src={url}
                      alt={f.movie_title}
                      fill
                      sizes="130px"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ color: "var(--t3)", fontSize: "11px" }}
                    >
                      No poster
                    </div>
                  )}
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--t1)",
                    margin: 0,
                    lineHeight: 1.3,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f.movie_title}
                </p>
                <p
                  style={{
                    fontSize: "10px",
                    color: "var(--t3)",
                    margin: "2px 0 0",
                  }}
                >
                  {relativeTime(f.viewed_at)}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </article>
  );
}
