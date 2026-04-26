"use client";

import { useState, useEffect } from "react";
import type { Film } from "@/lib/types";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import Icon from "@/components/ui/Icon";

type FilterType = "title" | "actor" | "director";

const FILTERS: { label: string; value: FilterType }[] = [
  { label: "Film Title", value: "title" },
  { label: "Actor", value: "actor" },
  { label: "Director", value: "director" },
];

interface SearchInputProps {
  onResults: (films: Film[]) => void;
  onLoading?: (loading: boolean) => void;
}

export default function SearchInput({ onResults, onLoading }: SearchInputProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("title");
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query, 400);

  useEffect(() => {
    const trimmed = debouncedQuery.trim();
    if (!trimmed) {
      onResults([]);
      onLoading?.(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    onLoading?.(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/movies/search?query=${encodeURIComponent(trimmed)}&type=${filter}`,
        );
        const data = await res.json();
        if (!cancelled) onResults(data.films ?? []);
      } catch {
        if (!cancelled) onResults([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          onLoading?.(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onResults / onLoading are intentionally excluded; re-running the effect on every parent render would fire spurious fetches. The callbacks are read at fetch time.
  }, [debouncedQuery, filter]);

  const placeholders: Record<FilterType, string> = {
    title: "Search for a film title...",
    actor: "Search by actor name...",
    director: "Search by director name...",
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-4">
      {/* Search Input */}
      <div className="relative flex items-center">
        <span
          className="absolute left-4 pointer-events-none"
          style={{ color: "var(--t3)", display: "flex" }}
        >
          <Icon name="search" size={20} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholders[filter]}
          aria-label={`Search by ${filter}`}
          className="w-full rounded-xl py-3 pl-12 pr-10 text-base transition-all duration-200"
          style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--t1)", outline: "none" }}
          onFocus={(e) => { e.currentTarget.style.borderColor = "var(--gold)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--gold-soft)"; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
        />
        {/* Clear button */}
        {query && (
          <button
            onClick={() => {
              setQuery("");
              onResults([]);
            }}
            className="absolute right-4 transition-colors"
            style={{ color: "var(--t3)" }}
            aria-label="Clear search"
          >
            <Icon name="close" size={16} />
          </button>
        )}
        {/* Loading spinner */}
        {isLoading && query && (
          <span className="absolute right-4 w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: "var(--border)", borderTopColor: "var(--t1)" }} />
        )}
      </div>

      {/* Quick-filter tag buttons */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className="px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 cursor-pointer"
            style={{
              background: filter === value ? "var(--gold)" : "transparent",
              color: filter === value ? "var(--accent-ink)" : "var(--t3)",
              borderColor: filter === value ? "var(--gold)" : "var(--border)",
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
