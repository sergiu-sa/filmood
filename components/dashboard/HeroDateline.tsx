"use client";

import { useSyncExternalStore } from "react";

interface HeroDatelineProps {
  /** If provided, the dateline shows the user's name instead of "N°01". */
  name: string | null;
}

function formatTime(date: Date) {
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const hhmm = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const tz = date.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();
  return `${weekday} ${hhmm} ${tz}`;
}

// Module-level cache: useSyncExternalStore requires getSnapshot to return the
// same reference between ticks so React doesn't infinite-loop on comparison.
let cachedNow: Date = new Date();

function subscribeTime(onChange: () => void) {
  const id = setInterval(() => {
    cachedNow = new Date();
    onChange();
  }, 60_000);
  return () => clearInterval(id);
}

function getTimeSnapshot(): Date {
  return cachedNow;
}

function getServerTimeSnapshot(): Date | null {
  return null;
}

export default function HeroDateline({ name }: HeroDatelineProps) {
  const now = useSyncExternalStore(subscribeTime, getTimeSnapshot, getServerTimeSnapshot);

  const prefix = name ? name.slice(0, 10).toUpperCase() : "N°01";
  const timePart = now ? formatTime(now) : "TONIGHT";
  const accent = name ? "var(--teal)" : "var(--gold-text)";

  return (
    <time
      suppressHydrationWarning
      dateTime={now?.toISOString()}
      style={{
        fontFamily: "var(--font-serif), Georgia, serif",
        fontStyle: "italic",
        fontSize: "10.5px",
        letterSpacing: "1.5px",
        color: "var(--t3)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ color: accent, fontWeight: 600 }}>{prefix}</span>
      <span style={{ margin: "0 6px", color: "var(--t3)" }}>·</span>
      <span>{timePart}</span>
    </time>
  );
}
