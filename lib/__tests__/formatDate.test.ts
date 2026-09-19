import { formatUTCDate, formatCalendarDate } from "@/lib/formatDate";

describe("formatUTCDate", () => {
  it("formats a plain YYYY-MM-DD date", () => {
    expect(formatUTCDate("2010-07-21")).toBe("Jul 21, 2010");
  });

  it("formats a full ISO timestamp", () => {
    expect(formatUTCDate("2026-02-08T14:30:00.000Z")).toBe("Feb 8, 2026");
  });

  // The whole reason this helper exists: server (UTC) and client (any zone)
  // must agree on the calendar day, or React 19 fails hydration.
  it("uses UTC, so a late-evening UTC timestamp keeps its UTC day", () => {
    expect(formatUTCDate("2026-02-08T23:59:59.000Z")).toBe("Feb 8, 2026");
    expect(formatUTCDate("2026-02-09T00:00:01.000Z")).toBe("Feb 9, 2026");
  });

  // ECMAScript reads an offset-less date-time as LOCAL time. vitest.config.ts
  // pins TZ to America/New_York precisely so these fail if the normalisation
  // is removed — under UTC they would pass either way, which is worthless
  // given CI and Vercel both run UTC.
  it("reads an offset-less date-time as UTC, not local time", () => {
    expect(formatUTCDate("2026-02-08T23:00:00")).toBe("Feb 8, 2026");
    expect(formatUTCDate("2026-02-08T00:30:00")).toBe("Feb 8, 2026");
  });

  // Near-miss separators V8 still accepts, which an allow-list regex misses.
  it("normalises offset-less variants V8 accepts", () => {
    expect(formatUTCDate("2010-07-21 00:00:00")).toBe("Jul 21, 2010");
    expect(formatUTCDate("2026-02-08t23:00:00")).toBe("Feb 8, 2026");
  });

  it("tolerates surrounding whitespace", () => {
    expect(formatUTCDate("  2026-02-08T23:00:00  ")).toBe("Feb 8, 2026");
    expect(formatUTCDate("2010-07-21\n")).toBe("Jul 21, 2010");
  });

  it("honours an explicit numeric offset rather than reading the date literally", () => {
    // 02:00 at +05:00 is 21:00 the previous day in UTC.
    expect(formatUTCDate("2026-02-08T02:00:00+05:00")).toBe("Feb 7, 2026");
  });

  it("returns null for unparseable or empty input so callers pick a fallback", () => {
    expect(formatUTCDate("not a date")).toBeNull();
    expect(formatUTCDate("")).toBeNull();
    expect(formatUTCDate(null)).toBeNull();
    expect(formatUTCDate(undefined)).toBeNull();
  });
});

describe("formatCalendarDate", () => {
  it("reads the date prefix literally, ignoring any offset", () => {
    // The release date is "the 21st in that country" — converting to UTC
    // would display the 20th.
    expect(formatCalendarDate("2010-07-21T00:00:00.000+02:00")).toBe("Jul 21, 2010");
    expect(formatCalendarDate("2010-07-21T00:00:00.000Z")).toBe("Jul 21, 2010");
    expect(formatCalendarDate("2010-07-21")).toBe("Jul 21, 2010");
  });

  // Obviously-wrong text beats a confidently-wrong corrected date.
  it("does not roll over an out-of-range day", () => {
    expect(formatCalendarDate("2021-02-30")).toBe("Feb 30, 2021");
  });

  it("returns null without a YYYY-MM-DD prefix, so the caller shows the raw value", () => {
    expect(formatCalendarDate("2010")).toBeNull();
    expect(formatCalendarDate("2010-07")).toBeNull();
    expect(formatCalendarDate("2010-13-01")).toBeNull();
    expect(formatCalendarDate("")).toBeNull();
    expect(formatCalendarDate(null)).toBeNull();
  });
});
