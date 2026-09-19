import { formatUTCDate } from "@/lib/formatDate";

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

  // ECMAScript parses an offset-less date-time as LOCAL time, so plain
  // `new Date(iso)` + UTC getters would report day 8 on a UTC server and
  // day 9 in New York. Vitest runs this file under TZ=UTC, so the assertion
  // below is the server's answer; the helper must give every viewer the same.
  it("reads an offset-less date-time as UTC, not local time", () => {
    expect(formatUTCDate("2026-02-08T23:00:00")).toBe("Feb 8, 2026");
    expect(formatUTCDate("2026-02-08T00:30:00")).toBe("Feb 8, 2026");
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
