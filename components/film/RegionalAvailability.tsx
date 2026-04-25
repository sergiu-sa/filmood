"use client";

import { useEffect, useMemo, useState } from "react";
import type { RegionalAvailabilityResponse } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/tmdb";

interface RegionalAvailabilityProps {
  data: RegionalAvailabilityResponse;
  /**
   * Country code → label map computed server-side and passed in as a prop.
   * Computing it here would call `Intl.DisplayNames` whose ICU data differs
   * between Node and the browser ("Hong Kong SAR China" vs "Hong Kong"),
   * causing hydration mismatches. Server is the single source of truth.
   */
  regionLabels: Record<string, string>;
}

const STORAGE_KEY = "filmood:regionalAvailability:lastRegion";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Deterministic date formatter. `toLocaleDateString` produces different output
 * on Node vs browser ICU ("Jul 21, 2010" vs "21 Jul 2010"), causing hydration
 * mismatches — so we format manually with a fixed English month table.
 * Input format: ISO date string (YYYY-MM-DD or full ISO).
 */
function formatReleaseDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, year, month, day] = m;
  const monthName = MONTHS[Number(month) - 1] ?? "";
  return `${monthName} ${Number(day)}, ${year}`;
}

export default function RegionalAvailability({
  data,
  regionLabels,
}: RegionalAvailabilityProps) {
  const labelFor = (code: string) => regionLabels[code] ?? code;

  const codes = useMemo(() => {
    const list = Object.keys(data.regions);
    list.sort((a, b) => labelFor(a).localeCompare(labelFor(b)));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- regionLabels is stable per page render; we want re-sort only when regions change
  }, [data.regions]);

  const [region, setRegion] = useState<string | null>(data.defaultRegion);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && data.regions[saved]) setRegion(saved);
    } catch {
      // localStorage unavailable (private mode, sandboxed iframe) — no-op.
    }
  }, [data.regions]);

  function handleChange(code: string) {
    setRegion(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Non-fatal; the choice still applies for the rest of the session.
    }
  }

  if (codes.length === 0) {
    return (
      <div
        className="w-full rounded-lg p-4 flex items-center justify-center"
        style={{ background: "var(--surface2)" }}
      >
        <span style={{ color: "var(--t3)" }}>
          No streaming or release info available
        </span>
      </div>
    );
  }

  const current = region && data.regions[region] ? data.regions[region] : null;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <label
          htmlFor="region-select"
          style={{
            fontSize: "11px",
            color: "var(--t2)",
            fontWeight: 500,
          }}
        >
          Region
        </label>
        <select
          id="region-select"
          value={region ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: "8px",
            background: "var(--tag-bg)",
            border: "1px solid var(--tag-border)",
            color: "var(--t1)",
            fontSize: "12px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {codes.map((code) => (
            <option key={code} value={code}>
              {labelFor(code)} ({code})
            </option>
          ))}
        </select>
      </div>

      {current && (current.certification || current.release_date) && (
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            marginBottom: "12px",
            fontSize: "12px",
            color: "var(--t2)",
          }}
        >
          {current.certification && (
            <span
              style={{
                padding: "3px 8px",
                borderRadius: "6px",
                background: "var(--tag-bg)",
                border: "1px solid var(--tag-border)",
                color: "var(--t1)",
                fontWeight: 700,
              }}
            >
              Rated {current.certification}
            </span>
          )}
          {current.release_date && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                color: "var(--t2)",
              }}
            >
              Released {formatReleaseDate(current.release_date)}
            </span>
          )}
        </div>
      )}

      {current && current.providers.length > 0 ? (
        <div
          className="flex flex-wrap gap-4 items-center"
        >
          {current.providers.map((provider) => (
            <div
              key={provider.provider_id}
              className="flex flex-col items-center w-20"
              title={provider.provider_name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tmdbImageUrl(provider.logo_path, "w92") ?? ""}
                alt={provider.provider_name}
                className="w-12 h-12 object-contain rounded bg-white shadow mb-1"
                loading="lazy"
              />
              <span
                className="text-xs text-center truncate w-full"
                style={{ color: "var(--t2)" }}
              >
                {provider.provider_name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "12px",
            borderRadius: "8px",
            background: "var(--surface2)",
            color: "var(--t3)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No streaming providers in this region
        </div>
      )}
    </div>
  );
}
