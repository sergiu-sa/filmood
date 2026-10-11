"use client";

import { useState, useCallback, useEffect, useRef, type RefObject } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import MoodBox from "./MoodBox";
import MoodPanel from "./MoodPanel";
import TrendingBox from "./TrendingBox";
import SearchToolbar from "./SearchToolbar";
import SearchPanel from "./SearchPanel";
import ExploreBox from "./ExploreBox";
import ExplorePanel from "./ExplorePanel";
import BottomSheet from "./BottomSheet";
import type { Film } from "@/lib/types";

export default function DashboardShell() {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Film[]>([]);
  // The search box's text (the toolbar's, and the phone sheet's box), and the search the results answer.
  const [query, setQuery] = useState("");
  const [resultsQuery, setResultsQuery] = useState("");
  const [panelError, setPanelError] = useState<{ retry: () => void } | null>(null);
  const [defaultResults, setDefaultResults] = useState<Film[]>([]);
  const [panelCategory, setPanelCategory] = useState<string | null>(null);
  const [panelGenre, setPanelGenre] = useState<number | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const isMobile = useMediaQuery("(max-width: 899px)");
  const searchResultsRef = useRef<HTMLDivElement>(null);

  // Close bottom sheet if viewport flips from mobile to desktop mid-open
  // Deferred to avoid synchronous setState inside effect (react-hooks/state-in-effect)
  useEffect(() => {
    if (!isMobile) {
      const timeout = setTimeout(() => setOpenPanel(null), 0);
      return () => clearTimeout(timeout);
    }
  }, [isMobile]);

  // Silently preload a default "trending" list so the search panel is never empty.
  // Fires once when the panel first opens; pills/tabs stay unhighlighted.
  useEffect(() => {
    if (openPanel !== "search" || defaultResults.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/movies/browse?category=trending");
        const data = await res.json();
        if (cancelled) return;
        const films: Film[] = data.films ?? [];
        setDefaultResults(films);
        setSearchResults((prev) =>
          prev.length === 0 && panelCategory === null ? films : prev,
        );
      } catch {
        /* silent — panel falls back to existing empty state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openPanel, defaultResults.length, panelCategory]);

  // Fired only on explicit search intent (Enter key, pill click) — desktop only.
  // Small delay so the panel has re-rendered with fresh results before we scroll.
  const handleSearchSubmit = useCallback(() => {
    if (isMobile) return;
    setTimeout(() => {
      searchResultsRef.current?.scrollIntoView({
        // A behavior passed here beats globals.css's reduced-motion scroll-behavior.
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 120);
  }, [isMobile]);

  const togglePanel = (panel: string) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setOpenPanel(null);

  // A closed desktop panel is inert, so focus on its Close would fall to <body>.
  const exploreBoxRef = useRef<HTMLElement>(null);
  const trendingBoxRef = useRef<HTMLElement>(null);
  const closeTo = (box: RefObject<HTMLElement | null>) => () => {
    closePanel();
    box.current?.focus();
  };

  const handleSearchResults = useCallback(
    (films: Film[], q: string) => {
      if (q) {
        setSearchLoading(false);
        setResultsQuery(q);
        setPanelError(null);
        setSearchResults(films);
        return;
      }
      // Cleared by picking a category: that category's fetch owns the results.
      if (panelCategory !== null && searchLoading) return;
      setSearchLoading(false);
      setResultsQuery("");
      setPanelError(null);
      // Cleared: fall back to the preloaded default list instead of collapsing the panel.
      if (defaultResults.length > 0 && panelCategory === null) {
        setSearchResults(defaultResults);
        return;
      }
      setSearchResults([]);
      setOpenPanel((prev) => (prev === "search" ? null : prev));
    },
    [defaultResults, panelCategory, searchLoading],
  );

  const handleSearchFailed = useCallback((q: string, retry: () => void) => {
    setSearchLoading(false);
    setResultsQuery(q);
    setSearchResults([]);
    setPanelError({ retry });
  }, []);

  // Called whenever SearchToolbar's active pill changes, to keep the panel's tabs in sync
  const handleActiveCategory = useCallback(
    (category: string | null, genreId?: number | null) => {
      setPanelCategory(category);
      setPanelGenre(genreId ?? null);
    },
    [],
  );

  // Called from SearchPanel tabs — fetches data and updates results
  const handlePanelCategoryChange = useCallback(
    async (category: string, genreId?: number) => {
      setPanelCategory(category);
      setPanelGenre(genreId ?? null);
      // The category replaces the search, in both boxes and in Full search.
      setQuery("");
      setResultsQuery("");
      setPanelError(null);
      setOpenPanel("search");
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ category });
        if (genreId) params.set("genre", String(genreId));
        const res = await fetch(`/api/movies/browse?${params.toString()}`);
        if (!res.ok) throw new Error(`Browse failed: ${res.status}`);
        const data = await res.json();
        setSearchResults(data.films ?? []);
      } catch {
        setSearchResults([]);
        setPanelError({ retry: () => handlePanelCategoryChange(category, genreId) });
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  // Panel content for bottom sheet (embedded mode, no animation wrapper)
  const moodPanelContent = (
    <MoodPanel isOpen={true} embedded onClose={closePanel} />
  );

  const retryPanel = panelError
    ? () => {
        setPanelError(null);
        setSearchLoading(true);
        panelError.retry();
      }
    : undefined;

  const searchPanelContent = (
    <SearchPanel
      isOpen={true}
      embedded
      films={searchResults}
      isLoading={searchLoading}
      query={resultsQuery}
      searchText={query}
      onSearchTextChange={setQuery}
      onRetry={retryPanel}
      activeCategory={panelCategory}
      activeGenre={panelGenre}
      onCategoryChange={handlePanelCategoryChange}
      onClose={closePanel}
    />
  );

  const explorePanelContent = (
    <ExplorePanel
      isOpen={true}
      embedded
      onClose={closePanel}
    />
  );

  const isBoxCollapsed = (key: string) =>
    !isMobile && openPanel !== null && openPanel !== key;

  return (
    <div id="dashboard" className="mx-auto" style={{ maxWidth: 1400 }}>
      <SearchToolbar
        query={query}
        onQueryChange={setQuery}
        onResults={handleSearchResults}
        onFailed={handleSearchFailed}
        onActiveCategory={handleActiveCategory}
        onExpand={() => setOpenPanel("search")}
        expandOnFocus={!isMobile}
        onCategoryFetch={handlePanelCategoryChange}
        onSubmit={handleSearchSubmit}
      />

      <div
        className="grid grid-cols-1 min-[900px]:grid-cols-3"
        style={{
          gap: 10,
          padding: "0 28px",
          gridTemplateColumns: !isMobile && openPanel
            ? openPanel === "mood"     ? "2fr 0.6fr 0.6fr"
            : openPanel === "explore"  ? "0.6fr 2fr 0.6fr"
                                       : "0.6fr 0.6fr 2fr"
            : !isMobile ? "1.4fr 0.8fr 0.8fr" : undefined,
          transition: "grid-template-columns 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          alignItems: "stretch",
        }}
      >
        <MoodBox
          onExpand={() => togglePanel("mood")}
          isExpanded={openPanel === "mood"}
          isCollapsed={isBoxCollapsed("mood")}
        />
        <ExploreBox
          ref={exploreBoxRef}
          onExpand={() => togglePanel("explore")}
          isExpanded={openPanel === "explore"}
          isCollapsed={isBoxCollapsed("explore")}
        />
        <TrendingBox
          ref={trendingBoxRef}
          onExpand={() => setOpenPanel("search")}
          isExpanded={openPanel === "search"}
          isCollapsed={isBoxCollapsed("search")}
        />
      </div>

      {/* Desktop: inline panels below the grid */}
      {!isMobile && (
        <div ref={searchResultsRef} style={{ padding: "0 28px" }}>
          <MoodPanel isOpen={openPanel === "mood"} onClose={closePanel} />
          <SearchPanel
            isOpen={openPanel === "search"}
            films={searchResults}
            isLoading={searchLoading}
            query={resultsQuery}
            onRetry={retryPanel}
            activeCategory={panelCategory}
            activeGenre={panelGenre}
            onCategoryChange={handlePanelCategoryChange}
            onClose={closeTo(trendingBoxRef)}
          />
          <ExplorePanel isOpen={openPanel === "explore"} onClose={closeTo(exploreBoxRef)} />
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={openPanel !== null}
          onClose={closePanel}
          label={openPanel === "mood" ? "How do you want to feel?" : "Panel"}
          accentColor={
            openPanel === "mood" ? "var(--gold)"
            : openPanel === "explore" ? "var(--teal)"
            : openPanel === "search" ? "var(--blue)"
            : undefined
          }
        >
          {openPanel === "mood" && moodPanelContent}
          {openPanel === "search" && searchPanelContent}
          {openPanel === "explore" && explorePanelContent}
        </BottomSheet>
      )}
    </div>
  );
}
