"use client";

import Link from "next/link";

export default function WatchlistPreview() {
  const items: never[] = [];

  return (
    <div className="mb-4 rounded-2xl border border-(--border) bg-(--surface) p-5.5">
      <div className="mb-3.5 text-[10px] font-semibold uppercase tracking-[1.8px] text-(--t3)">
        Watchlist
      </div>

      {items.length > 0 ? (
        <div className="grid grid-cols-4 gap-2 mb-3.5"></div>
      ) : (
        <div className="py-6 text-center">
          <p className="mb-1 text-[13px] text-(--t2)">No films saved yet</p>
          <p className="text-[11px] text-(--t3)">
            Films you save will appear here
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-(--border) pt-3.5">
        <span className="text-xs text-(--t3)"></span>
        <Link
          href="/"
          className="inline-flex items-center gap-1 rounded-lg border border-(--border) px-3.5 py-1.5 text-xs font-medium text-(--t2) no-underline transition-colors hover:border-(--border-h) hover:text-(--t1)"
        >
          Browse films →
        </Link>
      </div>
    </div>
  );
}
