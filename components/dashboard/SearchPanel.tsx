"use client";

import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import FilmGrid from "@/components/film/FilmGrid";
import type { Film } from "@/lib/types";
import {
  BROWSE_CATEGORIES,
  CategoryIcon,
  type BrowseCategory,
} from "@/lib/browseCategories";
import Icon from "@/components/ui/Icon";

type SortOrder = "popularity" | "rating" | "newest" | "title";

const PANEL_CATEGORIES = BROWSE_CATEGORIES;

const PANEL_GENRES = [
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
  { id: 99, label: "Documentary" },
  { id: 9648, label: "Mystery" },
];

function sortFilms(films: Film[], order: SortOrder): Film[] {
  const sorted = [...films];
  switch (order) {
    case "rating":
      return sorted.sort(
        (a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0),
      );
    case "newest":
      return sorted.sort((a, b) =>
        (b.release_date ?? "").localeCompare(a.release_date ?? ""),
      );
    case "title":
      return sorted.sort((a, b) => a.title.localeCompare(b.title));
    default:
      return sorted;
  }
}

// Skeleton grid shown while loading
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-5 lg:gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ animationDelay: `${i * 50}ms` }}>
          <div
            style={{
              borderRadius: "var(--r)",
              overflow: "hidden",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="search-skeleton-bar"
              style={{ aspectRatio: "2/3", width: "100%" }}
            />
            <div style={{ padding: "10px 12px 12px" }}>
              <div
                className="search-skeleton-bar"
                style={{ height: "13px", width: "75%", marginBottom: "8px" }}
              />
              <div
                className="search-skeleton-bar"
                style={{ height: "10px", width: "40%" }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

interface SearchPanelProps {
  isOpen: boolean;
  embedded?: boolean;
  films: Film[];
  isLoading?: boolean;
  /** The search these films answer; empty for a category or the default list. */
  query?: string;
  /** The phone sheet's search box, which edits the toolbar's query. Desktop has no box here. */
  searchText?: string;
  onSearchTextChange?: (text: string) => void;
  /** Set while the last load failed: the panel shows the error with Try again. */
  onRetry?: () => void;
  activeCategory?: string | null;
  activeGenre?: number | null;
  onCategoryChange?: (category: BrowseCategory, genreId?: number) => void;
  onClose: () => void;
}

export default function SearchPanel({
  isOpen,
  embedded = false,
  films,
  isLoading = false,
  query = "",
  searchText = "",
  onSearchTextChange,
  onRetry,
  activeCategory,
  activeGenre,
  onCategoryChange,
  onClose,
}: SearchPanelProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("popularity");
  const [inputFocused, setInputFocused] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Remount the grid wrapper when the underlying film set changes so the
  // .search-grid-enter CSS animation re-runs. Length + first-film-ID is a
  // cheap discriminator that's stable within a query but differs between
  // queries (different category, genre, or search term).
  const gridKey = `${films.length}-${films[0]?.id ?? "empty"}`;

  const displayFilms = useMemo(() => sortFilms(films, sortOrder), [films, sortOrder]);
  const failed = onRetry !== undefined;

  const handleCategoryClick = (catId: BrowseCategory) => {
    if (catId === "by-genre") {
      if (activeCategory === "by-genre") {
        onCategoryChange?.("trending" as BrowseCategory);
      } else {
        onCategoryChange?.(catId);
      }
      return;
    }
    onCategoryChange?.(catId);
  };

  const handleGenreClick = (genreId: number) => {
    onCategoryChange?.("by-genre", genreId);
  };

  // Get the active category label for the heading
  const activeCatLabel = PANEL_CATEGORIES.find(
    (c) => c.id === activeCategory,
  )?.label;
  const activeGenreLabel = PANEL_GENRES.find(
    (g) => g.id === activeGenre,
  )?.label;

  // Build the "Full search" URL carrying current state
  const browseHref = (() => {
    const p = new URLSearchParams();
    if (activeCategory) p.set("category", activeCategory);
    if (activeGenre) p.set("genre", String(activeGenre));
    if (query) p.set("q", query);
    const qs = p.toString();
    return qs ? `/browse?${qs}` : "/browse";
  })();

  const inner = (
    <div
      style={{
        background: "var(--surface)",
        border: embedded ? "none" : "1px solid var(--border)",
        borderRadius: embedded ? "0" : "16px",
        padding: embedded ? "18px 0 0" : "22px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient blue glow — top corner atmosphere */}
      {!embedded && (
        <div
          style={{
            position: "absolute",
            top: "-60px",
            right: "-40px",
            width: "280px",
            height: "180px",
            background:
              "radial-gradient(ellipse at center, var(--blue-glow) 0%, transparent 70%)",
            opacity: 0.6,
            pointerEvents: "none",
            filter: "blur(30px)",
          }}
        />
      )}

      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          marginBottom: "18px",
          position: "relative",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "10px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "1.8px",
              color: "var(--blue)",
              marginBottom: "8px",
            }}
          >
            Search
          </div>
          <h3
            ref={headingRef}
            tabIndex={-1}
            className="font-serif"
            style={{
              outline: "none",
              fontSize: "clamp(18px, 2vw, 24px)",
              fontWeight: 600,
              color: "var(--t1)",
              lineHeight: 1.2,
              margin: 0,
            }}
          >
            {activeCatLabel
              ? activeGenreLabel
                ? `${activeCatLabel} — ${activeGenreLabel}`
                : activeCatLabel
              : "Browse & Search"}
          </h3>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Result count badge */}
          {displayFilms.length > 0 && !isLoading && !failed && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--blue)",
                background: "var(--blue-soft)",
                padding: "4px 10px",
                borderRadius: "100px",
                border: "1px solid rgba(var(--blue-rgb), 0.15)",
                whiteSpace: "nowrap",
              }}
            >
              {displayFilms.length} film{displayFilms.length !== 1 ? "s" : ""}
            </span>
          )}
          <Link
            href={browseHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "9px 18px",
              borderRadius: "10px",
              background: "var(--blue)",
              color: "var(--blue-on)",
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1,
              transition: "filter 0.2s, transform 0.2s",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.filter = "brightness(1.12)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.filter = "none";
              e.currentTarget.style.transform = "none";
            }}
          >
            Full search
            <Icon name="arrow-right" size={12} />
          </Link>
        </div>
      </div>

      {/* Search + Sort row. Only the phone sheet has a box here: desktop searches from the toolbar above. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: "8px",
          marginBottom: "14px",
        }}
      >
        {onSearchTextChange && (
          <div style={{ position: "relative", flex: 1 }}>
            <span
              style={{
                position: "absolute",
                left: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                color: inputFocused ? "var(--blue)" : "var(--t3)",
                pointerEvents: "none",
                transition: "color 0.2s",
                display: "flex",
              }}
            >
              <Icon name="search" size={14} />
            </span>
            <input
              ref={inputRef}
              id="panel-search"
              name="panel-search"
              type="text"
              enterKeyHint="search"
              value={searchText}
              onChange={(e) => onSearchTextChange(e.target.value)}
              // The search runs as you type; Enter only puts the keyboard away.
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Film, actor, director…"
              aria-label="Search films"
              style={{
                width: "100%",
                minHeight: "44px",
                padding: "10px 44px 10px 34px",
                borderRadius: "10px",
                background: "var(--surface2)",
                border: `1px solid ${inputFocused ? "var(--blue)" : "var(--border)"}`,
                boxShadow: inputFocused ? "0 0 0 3px var(--blue-soft)" : "none",
                color: "var(--t1)",
                fontSize: "13px",
                outline: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            />
            {searchText && (
              <button
                type="button"
                onClick={() => {
                  onSearchTextChange("");
                  // The button unmounts with the text, so focus would fall to the sheet.
                  inputRef.current?.focus();
                }}
                style={{
                  position: "absolute",
                  right: 0,
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "44px",
                  height: "44px",
                  background: "none",
                  border: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Clear search"
              >
                <span
                  aria-hidden
                  style={{
                    background: "var(--surface3)",
                    borderRadius: "50%",
                    width: "18px",
                    height: "18px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--t2)",
                    fontSize: "11px",
                    lineHeight: 1,
                  }}
                >
                  ✕
                </span>
              </button>
            )}
          </div>
        )}

        <label htmlFor="panel-sort" className="sr-only">Sort by</label>
        <select
          id="panel-sort"
          name="panel-sort"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          style={{
            // In the phone sheet it sits beside the search box, a 44px target.
            minHeight: onSearchTextChange ? "44px" : undefined,
            padding: "10px 12px",
            borderRadius: "10px",
            background: "var(--surface2)",
            border: "1px solid var(--border)",
            color: "var(--t2)",
            fontSize: "12px",
            fontWeight: 500,
            outline: "none",
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "border-color 0.2s",
          }}
        >
          <option value="popularity">Popularity</option>
          <option value="rating">Top Rated</option>
          <option value="newest">Newest</option>
          <option value="title">Title A–Z</option>
        </select>
      </div>

      {/* Category tabs */}
      <div
        style={{
          display: "flex",
          gap: "5px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        {PANEL_CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryClick(cat.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "7px 13px",
                borderRadius: "999px",
                fontSize: "12px",
                fontWeight: isActive ? 600 : 500,
                lineHeight: 1,
                cursor: "pointer",
                transition: "all 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
                border: "1px solid",
                borderColor: isActive
                  ? "rgba(var(--blue-rgb), 0.3)"
                  : "var(--tag-border)",
                background: isActive ? "var(--blue-soft)" : "var(--tag-bg)",
                color: isActive ? "var(--blue)" : "var(--t2)",
                boxShadow: isActive ? "0 0 12px var(--blue-glow)" : "none",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = "var(--border-h)";
                  e.currentTarget.style.color = "var(--t1)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = "var(--tag-border)";
                  e.currentTarget.style.color = "var(--t2)";
                  e.currentTarget.style.transform = "none";
                }
              }}
            >
              <CategoryIcon category={cat} size={12} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Genre chips (visible when By Genre is active) */}
      {activeCategory === "by-genre" && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "6px",
            marginBottom: "16px",
            paddingBottom: "14px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {PANEL_GENRES.map((g, i) => {
            const isActive = activeGenre === g.id;
            return (
              <button
                key={g.id}
                type="button"
                className="search-genre-chip"
                onClick={() => handleGenreClick(g.id)}
                style={{
                  padding: "6px 13px",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 500,
                  lineHeight: 1,
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border: "1px solid",
                  animationDelay: `${i * 30}ms`,
                  borderColor: isActive
                    ? "rgba(var(--blue-rgb), 0.35)"
                    : "var(--tag-border)",
                  background: isActive ? "var(--blue-soft)" : "var(--tag-bg)",
                  color: isActive ? "var(--blue)" : "var(--t3)",
                  boxShadow: isActive ? "0 0 8px var(--blue-glow)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--border-h)";
                    e.currentTarget.style.color = "var(--t2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--tag-border)";
                    e.currentTarget.style.color = "var(--t3)";
                  }
                }}
              >
                {g.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Film grid / Loading / Error / Empty state */}
      {isLoading ? (
        <LoadingSkeleton />
      ) : failed ? (
        <div role="alert" style={{ textAlign: "center", padding: "48px 20px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "var(--blue-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span style={{ color: "var(--blue)", opacity: 0.7, display: "flex" }}>
              <Icon name="search" size={24} />
            </span>
          </div>
          <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--t2)", margin: "0 0 14px" }}>
            Couldn&apos;t reach the film database.
          </p>
          <button
            type="button"
            onClick={() => {
              // Try again unmounts with the error, so focus would fall to <body>.
              headingRef.current?.focus();
              onRetry();
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              boxSizing: "border-box",
              padding: "0 20px",
              borderRadius: "10px",
              border: "none",
              background: "var(--blue)",
              color: "var(--blue-on)",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      ) : displayFilms.length > 0 ? (
        <div key={gridKey} className="search-grid-enter">
          <FilmGrid films={displayFilms} accentBase="var(--blue)" />
        </div>
      ) : (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "var(--t3)",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "14px",
              background: "var(--blue-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <span style={{ color: "var(--blue)", opacity: 0.7, display: "flex" }}>
              <Icon name="search" size={24} />
            </span>
          </div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: "var(--t2)",
              marginBottom: "6px",
            }}
          >
            {query
              ? `No films matching "${query}"`
              : "Pick a category to start browsing"}
          </p>
          <p style={{ fontSize: "12px", color: "var(--t3)", lineHeight: 1.5 }}>
            {query
              ? "Try a different search term"
              : "Or type in the search box above"}
          </p>
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px",
          borderTop: "1px solid var(--border)",
          paddingTop: "14px",
          marginTop: "18px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--t3)" }}>
          {isLoading ? (
            "Loading..."
          ) : failed ? null : displayFilms.length > 0 ? (
            <>
              Showing{" "}
              <strong style={{ color: "var(--t2)", fontWeight: 600 }}>
                {displayFilms.length}
              </strong>{" "}
              film{displayFilms.length !== 1 ? "s" : ""}
              {query ? ` matching "${query}"` : ""}
            </>
          ) : (
            "No results"
          )}
        </span>

      <button
          onClick={onClose}
          className="cursor-pointer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "9px 18px",
            borderRadius: "10px",
            background: "none",
            color: "var(--t2)",
            fontSize: "13px",
            fontWeight: 500,
            lineHeight: 1,
            border: "1px solid var(--border)",
            transition: "all 0.25s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-h)";
            e.currentTarget.style.color = "var(--t1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.color = "var(--t2)";
          }}
        >
          Close
        </button>
      </div>
    </div>
  );

  return embedded ? (
    inner
  ) : (
    <div
      // Collapsed, the panel is only hidden visually; inert keeps its controls out of the Tab order.
      inert={!isOpen}
      style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        opacity: isOpen ? 1 : 0,
        transition:
          "grid-template-rows 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s, padding 0.4s",
        paddingBottom: isOpen ? "10px" : "0",
      }}
    >
      <div style={{ overflow: "hidden", minHeight: 0 }}>{inner}</div>
    </div>
  );
}
