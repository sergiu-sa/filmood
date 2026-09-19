/**
 * Deterministic `MMM D, YYYY` formatter for components that server-render.
 *
 * `toLocaleDateString` resolves against whichever ICU build is running, so
 * Node and the browser disagree ("Feb 8, 2026" vs "8 Feb 2026") and React 19
 * fails hydration. A fixed English month table plus UTC getters keeps server
 * and client on the same string and the same calendar day, whatever the
 * viewer's timezone.
 *
 * Returns null on an unparseable input so the caller decides the fallback —
 * same contract as `tmdbImageUrl`.
 *
 * Accepts `YYYY-MM-DD`, a full ISO timestamp with `Z` or a numeric offset, and
 * an offset-less `YYYY-MM-DDTHH:mm:ss`. That last form is the trap: ECMAScript
 * parses a date-time with no offset as *local* time, so `2026-02-08T23:00:00`
 * is day 8 on a UTC server and day 9 in New York — the precise mismatch this
 * module exists to prevent. Such input is read as UTC instead. Date-only and
 * explicit-offset forms already parse deterministically and are left alone.
 */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** A time component with no trailing `Z` and no `±HH:mm` offset. */
const OFFSETLESS_DATETIME = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/;

export function formatUTCDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(OFFSETLESS_DATETIME.test(iso) ? `${iso}Z` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
