"use client";

import { useState, useRef } from "react";
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

interface SearchToolbarProps {
  /** The box's text; the phone sheet's box edits the same query. */
  query: string;
  onQueryChange: (query: string) => void;
  /** A search is in flight. */
  loading?: boolean;
  /** The pill to highlight; null while searching. */
  activeCategory: string | null;
  /** A pill picked, or null when the highlighted one is clicked again. */
  onCategory: (category: string | null) => void;
  onExpand: () => void;
  /** A sheet hands focus back to this box when it closes, so on phones focus must not reopen it. */
  expandOnFocus?: boolean;
  /** Enter: search now and show the results. */
  onSubmit: () => void;
}

export default function SearchToolbar({
  query,
  onQueryChange,
  loading = false,
  activeCategory,
  onCategory,
  onExpand,
  expandOnFocus = true,
  onSubmit,
}: SearchToolbarProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (!query.trim()) return;
              inputRef.current?.blur();
              onSubmit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onQueryChange("");
              inputRef.current?.blur();
            }
          }}
          onClick={onExpand}
          onFocus={() => {
            setFocused(true);
            if (expandOnFocus) onExpand();
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
        {loading && (
          <span
            style={{
              position: "absolute",
              right: 10,
              top: "50%",
              // translate, not transform: spin's transform would replace it.
              translate: "0 -50%",
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
            onClick={() => onCategory(activeCategory === c.id ? null : c.id)}
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
