// Deterministic `MMM D, YYYY` formatting for components that server-render.
//
// `toLocaleDateString` resolves against whichever ICU build is running, so Node
// and the browser disagree ("Feb 8, 2026" vs "8 Feb 2026") and React 19 fails
// hydration. A fixed English month table avoids that.
//
// Two exports, because the app formats two different things. A review's
// `created_at` is an instant, so it must be pinned to a single timezone. A
// country's release date is a calendar date that never had a time — running it
// through `Date` would let an offset shift the displayed day.

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Ends in `Z` or a `±HH:mm` / `±HHmm` offset. */
const HAS_OFFSET = /(?:Z|[+-]\d{2}:?\d{2})$/i;
/** Contains a clock time, i.e. is a date-time rather than a bare date. */
const HAS_TIME = /\d{1,2}:\d{2}/;
/** A leading `YYYY-MM-DD`, the only part a calendar date needs. */
const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Format an instant as `MMM D, YYYY` in UTC. Use for timestamps — review dates,
 * activity times — where the underlying value is a moment, not a day.
 *
 * ECMAScript reads a date-time with no offset as *local* time, so
 * `2026-02-08T23:00:00` is day 8 on a UTC server and day 9 in New York. That is
 * the mismatch this module exists to prevent, so such input is treated as UTC.
 * Values that already carry `Z` or an offset parse deterministically and are
 * left alone.
 *
 * Returns null on unparseable input so the caller picks the fallback — same
 * contract as `tmdbImageUrl`.
 */
export function formatUTCDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = iso.trim();
  if (!s) return null;
  const d = new Date(HAS_TIME.test(s) && !HAS_OFFSET.test(s) ? `${s}Z` : s);
  if (Number.isNaN(d.getTime())) return null;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/**
 * Format a calendar date as `MMM D, YYYY` by reading the `YYYY-MM-DD` prefix
 * literally. Use for dates that belong to a place rather than a moment — a
 * film's release date in a given country.
 *
 * Deliberately never constructs a `Date`: `2010-07-21T00:00:00+02:00` is
 * "released on the 21st", and converting it to UTC would display the 20th. The
 * same literalness means a malformed date stays visibly malformed (`2021-02-30`
 * renders as written, rather than rolling over to Mar 2) instead of being
 * silently corrected into a plausible wrong answer.
 *
 * Returns null when there is no leading `YYYY-MM-DD`, so the caller can fall
 * back to showing the raw value.
 */
export function formatCalendarDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = DATE_PREFIX.exec(iso.trim());
  if (!m) return null;
  const [, year, month, day] = m;
  const monthName = MONTHS[Number(month) - 1];
  if (!monthName) return null;
  return `${monthName} ${Number(day)}, ${year}`;
}
