"use client";

import { useMediaQuery } from "@/lib/useMediaQuery";

/** The mood tiles' columns: 2 below 640, 3 below 900, 4 from 900. Layout only; each tile carries its own mode. */
export default function MoodGrid({ children, gap = 12 }: { children: React.ReactNode; gap?: number }) {
  // 899, not 900: DashboardShell swaps to the sheet at the same width.
  const narrow = useMediaQuery("(max-width: 639px)");
  const medium = useMediaQuery("(max-width: 899px)");
  const columns = narrow ? 2 : medium ? 3 : 4;

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${gap}px` }}>
      {children}
    </div>
  );
}
