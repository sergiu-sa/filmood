"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Film } from "@/lib/types";
import Icon from "@/components/ui/Icon";

// Compact toolbar variant — uses the shared BROWSE_CATEGORIES ids but
// keeps shorter labels for the tight horizontal real estate. The label
// override is the only reason this list isn't pulled directly from
// `lib/browseCategories.tsx`.
const BROWSE_CATEGORIES = [
  { id: "trending", label: "Trending" },
  { id: "top-rated", label: "Top Rated" },
  { id: "new-releases", label: "New Releases" },
  { id: "in-cinemas", label: "In Cinemas" },
  { id: "by-genre", label: "By Genre" },
  { id: "streaming-norway", label: "Streaming NO" },
] as const;

type BrowseCategory = (typeof BROWSE_CATEGORIES)[number]["id"];

interface SearchToolbarProps {
  onResults: (films: Film[], keepOpen?: boolean) => void;
  onActiveCategory: (category: string | null, genreId?: number | null) => void;
  onExpand: () => void;
  onCategoryFetch?: (category: string, genreId?: number) => void;
  /** Fired on explicit user intent (Enter key or pill click) — parent scrolls to results. */
  onSubmit?: () => void;
}

export default function SearchToolbar({
  onResults,
  onActiveCategory,
  onExpand,
  onCategoryFetch,
  onSubmit,
}: SearchToolbarProps) {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<BrowseCategory | null>(
    null,
  );
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    onActiveCategory(activeCategory, null);
  }, [activeCategory]); // eslint-disable-line react-hooks/exhaustive-deps

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        onResults([]);
        return;
      }
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setIsLoading(true);
      setActiveCategory(null);
      try {
        const res = await fetch(
          `/api/movies/search?query=${encodeURIComponent(q.trim())}&type=all`,
          { signal: ctrl.signal },
        );
        const data = await res.json();
        onResults(data.films ?? []);
        onExpand();
      } catch (err) {
        if ((err as Error).name !== "AbortError") onResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [onResults, onExpand],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      onResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => doSearch(query), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async () => {
    const q = query.trim();
    if (!q) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await doSearch(q);
    inputRef.current?.blur();
    onSubmit?.();
  };

  const handleCategoryClick = (id: BrowseCategory) => {
    if (activeCategory === id) {
      setActiveCategory(null);
      onResults([]);
      return;
    }
    setActiveCategory(id);
    setQuery("");
    onExpand();
    onCategoryFetch?.(id);
    onSubmit?.();
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        flexWrap: "wrap",
        padding: "10px 14px",
        borderRadius: 14,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        margin: "0 28px 10px",
      }}
    >
      <div style={{ position: "relative", flex: "1 1 220px" }}>
        <input
          ref={inputRef}
          id="search-toolbar-input"
          name="search-toolbar-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setQuery("");
              inputRef.current?.blur();
            }
          }}
          onFocus={() => {
            setFocused(true);
            onExpand();
          }}
          onBlur={() => setFocused(false)}
          placeholder="Film, actor, director…  (press Enter to search)"
          aria-label="Search films — press Enter to submit"
          style={{
            width: "100%",
            padding: "9px 14px 9px 36px",
            borderRadius: 10,
            background: "var(--surface2)",
            border: `1px solid ${focused ? "var(--blue)" : "var(--border)"}`,
            color: "var(--t1)",
            fontSize: 13,
            outline: "none",
            transition: "border-color 0.2s",
          }}
        />
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--t3)",
            display: "flex",
          }}
        >
          <Icon name="search" size={14} />
        </span>
        {isLoading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              transform: "translateY(-50%)",
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid var(--border-h)",
              borderTopColor: "var(--t1)",
              animation: "spin 0.8s linear infinite",
            }}
          />
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {BROWSE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => handleCategoryClick(c.id)}
            style={{
              padding: "6px 11px",
              borderRadius: 999,
              border: `1px solid ${
                activeCategory === c.id ? "var(--border-active)" : "var(--border)"
              }`,
              background:
                activeCategory === c.id ? "var(--surface2)" : "transparent",
              color: activeCategory === c.id ? "var(--t1)" : "var(--t2)",
              fontSize: 11.5,
              cursor: "pointer",
              transition: "all 0.18s",
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
