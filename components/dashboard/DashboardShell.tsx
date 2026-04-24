"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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

export default function DashboardShell({
  selectedMoods: selectedMoodsProp,
  onSelectMood: onSelectMoodProp,
}: {
  selectedMoods?: Set<string>;
  onSelectMood?: (key: string) => void;
} = {}) {
  const [localSelectedMoods, setLocalSelectedMoods] = useState<Set<string>>(new Set());
  const selectedMoods = selectedMoodsProp ?? localSelectedMoods;
  const handleSelectMood =
    onSelectMoodProp ??
    ((key: string) => {
      setLocalSelectedMoods((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    });

  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Film[]>([]);
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
        behavior: "smooth",
        block: "start",
      });
    }, 120);
  }, [isMobile]);

  const togglePanel = (panel: string) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setOpenPanel(null);

  const handleSearchResults = useCallback(
    (films: Film[], keepOpen?: boolean) => {
      // When the toolbar reports an empty result set (user cleared the query),
      // fall back to the preloaded default list instead of collapsing the panel.
      if (films.length === 0 && defaultResults.length > 0 && panelCategory === null) {
        setSearchResults(defaultResults);
        return;
      }
      setSearchResults(films);
      if (films.length === 0 && !keepOpen) {
        setOpenPanel((prev) => (prev === "search" ? null : prev));
      }
    },
    [defaultResults, panelCategory],
  );

  // Called from SearchBox pills to keep panel tabs in sync
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
      setOpenPanel("search");
      setSearchLoading(true);
      try {
        const params = new URLSearchParams({ category });
        if (genreId) params.set("genre", String(genreId));
        const res = await fetch(`/api/movies/browse?${params.toString()}`);
        const data = await res.json();
        setSearchResults(data.films ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  // Panel content for bottom sheet (embedded mode, no animation wrapper)
  const moodPanelContent = (
    <MoodPanel
      isOpen={true}
      embedded
      selectedMoods={selectedMoods}
      onSelectMood={handleSelectMood}
      onClose={closePanel}
    />
  );

  const searchPanelContent = (
    <SearchPanel
      isOpen={true}
      embedded
      films={searchResults}
      isLoading={searchLoading}
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
        onResults={handleSearchResults}
        onActiveCategory={handleActiveCategory}
        onExpand={() => setOpenPanel("search")}
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
          onExpand={() => togglePanel("explore")}
          isExpanded={openPanel === "explore"}
          isCollapsed={isBoxCollapsed("explore")}
        />
        <TrendingBox
          onExpand={() => setOpenPanel("search")}
          isExpanded={openPanel === "search"}
          isCollapsed={isBoxCollapsed("search")}
        />
      </div>

      {/* Desktop: inline panels below the grid */}
      {!isMobile && (
        <div ref={searchResultsRef} style={{ padding: "0 28px" }}>
          <MoodPanel
            isOpen={openPanel === "mood"}
            selectedMoods={selectedMoods}
            onSelectMood={handleSelectMood}
            onClose={closePanel}
          />
          <SearchPanel
            isOpen={openPanel === "search"}
            films={searchResults}
            isLoading={searchLoading}
            activeCategory={panelCategory}
            activeGenre={panelGenre}
            onCategoryChange={handlePanelCategoryChange}
            onClose={closePanel}
          />
          <ExplorePanel isOpen={openPanel === "explore"} onClose={closePanel} />
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={openPanel !== null}
          onClose={closePanel}
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
