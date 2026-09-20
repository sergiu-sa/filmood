"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Film } from "@/lib/types";
import CollapsedBoxRail from "./CollapsedBoxRail";
import {
  BROWSE_CATEGORIES,
  CategoryIcon,
  type BrowseCategory,
} from "@/lib/browseCategories";
import { genreMap } from "@/lib/genres";
import Icon from "@/components/ui/Icon";

// Compact panel-genre subset — `lib/genres.ts` has the full TMDB list, but
// the search-box panel only surfaces ten popular ones.
const GENRES = [
  { id: 28, label: "Action" },
  { id: 35, label: "Comedy" },
  { id: 18, label: "Drama" },
  { id: 27, label: "Horror" },
  { id: 878, label: "Sci-Fi" },
  { id: 10749, label: "Romance" },
  { id: 53, label: "Thriller" },
  { id: 16, label: "Animation" },
  { id: 80, label: "Crime" },
  { id: 14, label: "Fantasy" },
];

interface TrendingItem {
  id: number;
  title: string;
  genre_ids: number[];
}

interface SearchBoxProps {
  onResults?: (films: Film[], keepOpen?: boolean) => void;
  onLabel?: (label: string) => void;
  onActiveCategory?: (category: string | null, genreId?: number | null) => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  isCollapsed?: boolean;
}

export default function SearchBox({
  onResults,
  onLabel,
  onActiveCategory,
  onExpand,
  isExpanded,
  isCollapsed,
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<BrowseCategory | null>(
    null,
  );
  const [activeGenre, setActiveGenre] = useState<number | null>(null);
  const [trending, setTrending] = useState<TrendingItem[]>([]);
  const [inputFocused, setInputFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync active category/genre up to parent so the panel tabs stay in sync
  useEffect(() => {
    onActiveCategory?.(activeCategory, activeGenre);
  }, [activeCategory, activeGenre]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch trending movies on mount
  useEffect(() => {
    fetch("/api/movies/trending")
      .then((res) => res.json())
      .then((data) => setTrending(data.films ?? []))
      .catch(() => {});
  }, []);

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        onResults?.([]);
        return;
      }
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsLoading(true);
      setActiveCategory(null);
      try {
        const res = await fetch(
          `/api/movies/search?query=${encodeURIComponent(q.trim())}&type=all`,
          { signal: controller.signal },
        );
        const data = await res.json();
        const films = data.films ?? [];
        onResults?.(films);
        onLabel?.(
          `Search results — ${films.length} film${films.length !== 1 ? "s" : ""}`,
        );
        onExpand?.();
      } catch (err) {
        if ((err as Error).name !== "AbortError") onResults?.([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onResults, onLabel, onExpand],
  );

  const doBrowse = useCallback(
    async (category: BrowseCategory, genreId?: number) => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ category });
        if (genreId) params.set("genre", String(genreId));
        const res = await fetch(`/api/movies/browse?${params.toString()}`);
        const data = await res.json();
        const films = data.films ?? [];
        onResults?.(films, true);
        const catLabel =
          BROWSE_CATEGORIES.find((c) => c.id === category)?.label ?? category;
        const genreLabel = genreId
          ? GENRES.find((g) => g.id === genreId)?.label
          : undefined;
        onLabel?.(
          genreLabel
            ? `${catLabel} — ${genreLabel} — ${films.length} film${films.length !== 1 ? "s" : ""}`
            : `${catLabel} — ${films.length} film${films.length !== 1 ? "s" : ""}`,
        );
      } catch {
        onResults?.([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onResults, onLabel],
  );

  // Debounced search on typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      onResults?.([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryClick = (categoryId: BrowseCategory) => {
    if (categoryId === "by-genre") {
      if (activeCategory === "by-genre") {
        setActiveCategory(null);
        setActiveGenre(null);
        onResults?.([]);
      } else {
        setActiveCategory("by-genre");
        setQuery("");
        onExpand?.();
      }
      return;
    }
    if (activeCategory === categoryId) {
      setActiveCategory(null);
      onResults?.([]);
      return;
    }
    setActiveCategory(categoryId);
    setQuery("");
    onExpand?.();
    doBrowse(categoryId);
  };

  const handleGenreClick = (genreId: number) => {
    setActiveGenre(genreId);
    onExpand?.();
    doBrowse("by-genre", genreId);
  };

  // When panel opens and nothing is active, load trending into the panel
  const handleSectionClick = () => {
    onExpand?.();
    if (!query && !activeCategory) {
      doBrowse("trending");
    }
  };

  if (isCollapsed) {
    return (
      <CollapsedBoxRail
        label="Search"
        title="Find anything"
        sub="Search by film title, actor, or director."
        accent="var(--blue)"
        accentSoft="var(--blue-soft)"
        ariaLabel="Find anything — search by film, actor, or director"
        onActivate={() => onExpand?.()}
      />
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={handleSectionClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleSectionClick(); } }}
      aria-expanded={isExpanded}
      aria-label="Find anything — search by film, actor, or director"
      className="relative overflow-hidden cursor-pointer"
      style={{
        background: "var(--surface)",
        border: `1px solid ${isExpanded ? "var(--blue)" : "var(--border)"}`,
        borderRadius: "16px",
        padding: "22px",
        transition: "border-color 0.3s, box-shadow 0.3s",
        boxShadow: isExpanded
          ? "0 0 0 1px var(--blue), 0 0 16px var(--blue-glow)"
          : "none",
        minHeight: "100%",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1.8px",
          color: "var(--blue)",
          marginBottom: "12px",
        }}
      >
        Search
      </div>

      <h2
        className="font-serif"
        style={{
          fontSize: "clamp(20px, 2.2vw, 26px)",
          fontWeight: 600,
          color: "var(--t1)",
          lineHeight: 1.2,
          marginBottom: "6px",
        }}
      >
        Find anything
      </h2>

      <p
        style={{
          fontSize: "13px",
          color: "var(--t2)",
          lineHeight: 1.5,
          marginBottom: "16px",
        }}
      >
        Search by film title, actor, or director.
      </p>

      {/* Search Input */}
      <div className="relative mb-3.5" onClick={(e) => e.stopPropagation()}>
        <span
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2"
          style={{ color: "var(--t3)", display: "flex" }}
        >
          <Icon name="search" size={16} />
        </span>
        <input
          id="search-box-input"
          name="search-box-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setInputFocused(true);
            if (!query && !activeCategory) doBrowse("trending");
            onExpand?.();
          }}
          onBlur={() => setInputFocused(false)}
          placeholder="Film, actor, director..."
          aria-label="Search films, actors, or directors"
          style={{
            width: "100%",
            borderRadius: "12px",
            background: "var(--surface2)",
            border: `1px solid ${inputFocused ? "var(--blue)" : "var(--border)"}`,
            boxShadow: inputFocused ? "0 0 0 3px var(--blue-soft)" : "none",
            color: "var(--t1)",
            padding: "11px 14px 11px 40px",
            fontSize: "14px",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
        />
        {isLoading && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        )}
      </div>

      {/* Browse category buttons */}
      <div
        className="mb-4 flex flex-wrap gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {BROWSE_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => handleCategoryClick(cat.id)}
            style={{
              borderRadius: "999px",
              border: `1px solid ${
                activeCategory === cat.id
                  ? "var(--border-active)"
                  : "var(--border)"
              }`,
              background:
                activeCategory === cat.id ? "var(--surface2)" : "var(--bg)",
              color: activeCategory === cat.id ? "var(--t1)" : "var(--t2)",
              fontSize: "12px",
              lineHeight: 1,
              padding: "8px 11px",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <CategoryIcon category={cat} size={13} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Genre sub-buttons (shown when By Genre is active) */}
      {activeCategory === "by-genre" && (
        <div
          className="mb-4 flex flex-wrap gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => handleGenreClick(g.id)}
              style={{
                borderRadius: "999px",
                border: `1px solid ${activeGenre === g.id ? "var(--border-active)" : "var(--border)"}`,
                background:
                  activeGenre === g.id ? "var(--surface2)" : "var(--bg)",
                color: activeGenre === g.id ? "var(--t1)" : "var(--t3)",
                fontSize: "11px",
                lineHeight: 1,
                padding: "6px 10px",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* Trending Today list (shown when no search/browse active) */}
      {!query && !activeCategory && (
        <div>
          <div
            style={{
              color: "var(--t3)",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "1.8px",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            Trending Today
          </div>

          <div className="flex flex-col">
            {trending.map((item, i) => (
              <Link
                key={item.id}
                href={`/film/${item.id}`}
                onClick={(e) => e.stopPropagation()}
                className="group grid grid-cols-[auto_1fr_auto] items-center gap-2.5 rounded-lg"
                style={{
                  padding: "7px 8px",
                  margin: "0 -8px",
                  textDecoration: "none",
                  transition: "background 0.18s",
                  animationDelay: `${i * 60}ms`,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--surface2)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
                onFocus={(e) =>
                  (e.currentTarget.style.background = "var(--surface2)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <span
                  style={{
                    color: "var(--t3)",
                    fontSize: "12px",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: "20px",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  style={{
                    color: "var(--t1)",
                    fontSize: "14px",
                    fontWeight: 500,
                    transition: "color 0.18s",
                  }}
                  className="group-hover:text-white"
                >
                  {item.title}
                </span>
                <span style={{ color: "var(--t3)", fontSize: "12px" }}>
                  {genreMap[item.genre_ids?.[0]] ?? "Film"}
                </span>
              </Link>
            ))}
            {trending.length === 0 && (
              <span
                style={{
                  color: "var(--t3)",
                  fontSize: "12px",
                  padding: "4px 8px",
                }}
              >
                Loading...
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
