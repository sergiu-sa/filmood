import type { AccentColor } from "./types";

/**
 * Consistent avatar colors for participants across all group pages.
 * Index by participant position so the same person gets the same color
 * in lobby, swipe, and results.
 */
export const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "var(--teal)", text: "var(--teal-on)" },
  { bg: "var(--gold)", text: "var(--gold-on)" },
  { bg: "var(--blue)", text: "var(--blue-on)" },
  { bg: "var(--violet)", text: "var(--violet-on)" },
  { bg: "var(--rose)", text: "var(--rose-on)" },
  { bg: "var(--ember)", text: "var(--ember-on)" },
];

/**
 * Single source of truth for mood accent CSS variables. Imported by
 * MoodTile, SwipeCard, TopPickCard, and the results hero. All fields
 * are CSS variables so dark/light theme overrides propagate for free.
 *
 * - base:   solid color — fills, card borders, dots; never text
 * - text:   the accent as text, on --bg or --surface only
 * - on:     text on a base fill
 * - soft:   ~10% alpha  — chip background, ambient fill
 * - glow:   ~8% alpha   — radial blur auras behind cards
 * - border: ~25% alpha  — chip borders, outline accents
 */
export const ACCENT_VARS: Record<
  AccentColor,
  { base: string; text: string; on: string; soft: string; glow: string; border: string }
> = {
  gold:   { base: "var(--gold)",   text: "var(--gold-text)", on: "var(--gold-on)",   soft: "var(--gold-soft)",   glow: "var(--gold-glow)",   border: "var(--gold-border)" },
  blue:   { base: "var(--blue)",   text: "var(--blue)",      on: "var(--blue-on)",   soft: "var(--blue-soft)",   glow: "var(--blue-glow)",   border: "var(--blue-border)" },
  rose:   { base: "var(--rose)",   text: "var(--rose)",      on: "var(--rose-on)",   soft: "var(--rose-soft)",   glow: "var(--rose-glow)",   border: "var(--rose-border)" },
  violet: { base: "var(--violet)", text: "var(--violet)",    on: "var(--violet-on)", soft: "var(--violet-soft)", glow: "var(--violet-glow)", border: "var(--violet-border)" },
  teal:   { base: "var(--teal)",   text: "var(--teal)",      on: "var(--teal-on)",   soft: "var(--teal-soft)",   glow: "var(--teal-glow)",   border: "var(--teal-border)" },
  ember:  { base: "var(--ember)",  text: "var(--ember)",     on: "var(--ember-on)",  soft: "var(--ember-soft)",  glow: "var(--ember-glow)",  border: "var(--ember-border)" },
};
