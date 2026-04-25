import type { ReactNode } from "react";

/**
 * Single source of truth for the six browse categories. Pre-Session-7 the
 * same list (id, label, colored icon) was hand-duplicated across
 * `app/browse/page.tsx` (TABS, 13px icons + heading) and
 * `components/dashboard/SearchPanel.tsx` (PANEL_CATEGORIES, 12px icons).
 * Both consumers now import this and render the icon at whatever size they
 * need via `<CategoryIcon category={c} size={12} />`.
 */
export type BrowseCategory =
  | "trending"
  | "top-rated"
  | "new-releases"
  | "in-cinemas"
  | "by-genre"
  | "streaming-norway";

export interface BrowseCategoryDef {
  id: BrowseCategory;
  label: string;
  /** Long-form section heading used by the browse page. */
  heading: string;
  /** CSS color var that drives the icon stroke. */
  color: string;
  /** Inner SVG path content — wrapped by the renderer below. */
  paths: ReactNode;
}

export const BROWSE_CATEGORIES: BrowseCategoryDef[] = [
  {
    id: "trending",
    label: "Trending",
    heading: "Trending today",
    color: "var(--ember)",
    paths: <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />,
  },
  {
    id: "top-rated",
    label: "Top Rated",
    heading: "Top rated of all time",
    color: "var(--gold)",
    paths: (
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    ),
  },
  {
    id: "new-releases",
    label: "New Releases",
    heading: "New releases",
    color: "var(--blue)",
    paths: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  },
  {
    id: "in-cinemas",
    label: "In Cinemas",
    heading: "Now in cinemas (Norway)",
    color: "var(--rose)",
    paths: (
      <>
        <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
        <line x1="7" y1="2" x2="7" y2="22" />
        <line x1="17" y1="2" x2="17" y2="22" />
        <line x1="2" y1="12" x2="22" y2="12" />
      </>
    ),
  },
  {
    id: "by-genre",
    label: "By Genre",
    heading: "Browse by genre",
    color: "var(--violet)",
    paths: (
      <>
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </>
    ),
  },
  {
    id: "streaming-norway",
    label: "Streaming in Norway",
    heading: "Streaming in Norway",
    color: "var(--teal)",
    paths: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polygon points="10 8 16 12 10 16 10 8" />
      </>
    ),
  },
];

interface CategoryIconProps {
  category: BrowseCategoryDef;
  size: number;
}

export function CategoryIcon({ category, size }: CategoryIconProps) {
  return (
    <span style={{ color: category.color, display: "flex" }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {category.paths}
      </svg>
    </span>
  );
}
