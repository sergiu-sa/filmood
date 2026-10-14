"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useFilms } from "@/lib/useFilms";
import MoodBox from "./MoodBox";
import MoodPanel from "./MoodPanel";
import TrendingBox from "./TrendingBox";
import SearchToolbar from "./SearchToolbar";
import SearchPanel from "./SearchPanel";
import ExploreBox from "./ExploreBox";
import ExplorePanel from "./ExplorePanel";
import BottomSheet from "./BottomSheet";

const searchUrl = (q: string) => `/api/movies/search?query=${encodeURIComponent(q)}&type=all`;

type Category = { id: string; genre: number | null };

function listUrl(category: Category | null) {
  const params = new URLSearchParams({ category: category?.id ?? "trending" });
  if (category?.genre) params.set("genre", String(category.genre));
  return `/api/movies/browse?${params.toString()}`;
}

export default function DashboardShell() {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  // The search box's text: the toolbar's, and on phones the sheet's box too.
  const [query, setQuery] = useState("");
  // Enter searches the text at once instead of after the debounce.
  const [submitted, setSubmitted] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const [listAttempt, setListAttempt] = useState(0);

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

  // The panel shows the search while the box has one, else the list under it: the
  // picked category, or trending. Both are kept, so clearing the box shows the list at once.
  const text = query.trim();
  const debounced = useDebouncedValue(text, 400);
  const q = text === submitted ? submitted : debounced;
  const searching = q !== "" && text !== "";
  const search = useFilms(searching ? searchUrl(q) : null, searchAttempt);
  // Fetched once the panel has opened, not on every visit to home.
  const list = useFilms(openPanel === "search" ? listUrl(category) : null, listAttempt);
  const shown = searching ? search : list;

  const scrollToPanel = useCallback(() => {
    if (isMobile) return;
    // Small delay so the panel has opened before we scroll.
    setTimeout(() => {
      searchResultsRef.current?.scrollIntoView({
        // A behavior passed here beats globals.css's reduced-motion scroll-behavior.
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start",
      });
    }, 120);
  }, [isMobile]);

  const submitSearch = () => {
    setSubmitted(text);
    setOpenPanel("search");
    scrollToPanel();
  };

  const togglePanel = (panel: string) => {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  };

  const closePanel = () => setOpenPanel(null);

  // A closed desktop panel is inert, so focus on its Close would fall to <body>.
  const exploreBoxRef = useRef<HTMLButtonElement>(null);
  const trendingBoxRef = useRef<HTMLButtonElement>(null);
  const closeSearch = () => {
    closePanel();
    trendingBoxRef.current?.focus();
  };
  const closeExplore = () => {
    closePanel();
    exploreBoxRef.current?.focus();
  };

  // A pill or a panel tab. Picking a category replaces the search, in both boxes and in Full search.
  const selectCategory = (id: string | null, genre?: number) => {
    setQuery("");
    setCategory(id === null ? null : { id, genre: genre ?? null });
    // A pill clicked again unpicks its category and closes the panel, as it always has.
    setOpenPanel(id === null ? null : "search");
  };

  const retryPanel = () => (searching ? setSearchAttempt : setListAttempt)((a) => a + 1);

  // Panel content for bottom sheet (embedded mode, no animation wrapper)
  const moodPanelContent = (
    <MoodPanel isOpen={true} embedded onClose={closePanel} />
  );

  const searchPanelContent = (
    <SearchPanel
      isOpen={true}
      embedded
      films={shown.films}
      isLoading={shown.loading}
      query={searching ? q : ""}
      error={shown.error}
      onRetry={retryPanel}
      searchText={query}
      onSearchTextChange={setQuery}
      onSearchSubmit={submitSearch}
      activeCategory={searching ? null : (category?.id ?? null)}
      activeGenre={searching ? null : (category?.genre ?? null)}
      onCategoryChange={selectCategory}
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
        loading={searching && search.loading}
        activeCategory={searching ? null : (category?.id ?? null)}
        onCategory={(id) => {
          selectCategory(id);
          if (id) scrollToPanel();
        }}
        onExpand={() => setOpenPanel("search")}
        expandOnFocus={!isMobile}
        onSubmit={submitSearch}
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
          onExpand={() => togglePanel("search")}
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
            films={shown.films}
            isLoading={shown.loading}
            query={searching ? q : ""}
            error={shown.error}
            onRetry={retryPanel}
            activeCategory={searching ? null : (category?.id ?? null)}
            activeGenre={searching ? null : (category?.genre ?? null)}
            onCategoryChange={selectCategory}
            onClose={closeSearch}
          />
          <ExplorePanel isOpen={openPanel === "explore"} onClose={closeExplore} />
        </div>
      )}

      {/* Mobile: bottom sheet */}
      {isMobile && (
        <BottomSheet
          isOpen={openPanel !== null}
          onClose={closePanel}
          label={
            openPanel === "mood" ? "How do you want to feel?"
            : openPanel === "explore" ? "Group session"
            : "Browse & Search"
          }
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
