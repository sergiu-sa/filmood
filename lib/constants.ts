import type { AccentColor } from "./types";

/**
 * Consistent avatar colors for participants across all group pages.
 * Index by participant position so the same person gets the same color
 * in lobby, swipe, and results.
 */
export const AVATAR_COLORS: { bg: string; text: string }[] = [
  { bg: "var(--teal)", text: "#0a0a0c" },
  { bg: "var(--gold)", text: "#0a0a0c" },
  { bg: "var(--blue)", text: "#fff" },
  { bg: "var(--violet)", text: "#fff" },
  { bg: "var(--rose)", text: "#fff" },
  { bg: "var(--ember)", text: "#0a0a0c" },
];

/**
 * Single source of truth for mood accent CSS variables. Imported by
 * MoodCard, SwipeCard, TopPickCard, and the results hero. All fields
 * are CSS variables so dark/light theme overrides propagate for free.
 *
 * - base:   solid color — text, card borders, chip foreground
 * - soft:   ~10% alpha  — chip background, ambient fill
 * - glow:   ~8% alpha   — radial blur auras behind cards
 * - border: ~25% alpha  — chip borders, outline accents
 */
export const ACCENT_VARS: Record<
  AccentColor,
  { base: string; soft: string; glow: string; border: string }
> = {
  gold:   { base: "var(--gold)",   soft: "var(--gold-soft)",   glow: "var(--gold-glow)",   border: "var(--gold-border)" },
  blue:   { base: "var(--blue)",   soft: "var(--blue-soft)",   glow: "var(--blue-glow)",   border: "var(--blue-border)" },
  rose:   { base: "var(--rose)",   soft: "var(--rose-soft)",   glow: "var(--rose-glow)",   border: "var(--rose-border)" },
  violet: { base: "var(--violet)", soft: "var(--violet-soft)", glow: "var(--violet-glow)", border: "var(--violet-border)" },
  teal:   { base: "var(--teal)",   soft: "var(--teal-soft)",   glow: "var(--teal-glow)",   border: "var(--teal-border)" },
  ember:  { base: "var(--ember)",  soft: "var(--ember-soft)",  glow: "var(--ember-glow)",  border: "var(--ember-border)" },
};
