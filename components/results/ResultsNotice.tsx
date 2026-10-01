import Link from "next/link";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import { filmCount } from "@/lib/filmCount";
import type { FilterKey } from "@/lib/moodFilters";
import type { DiscoverResponse } from "@/lib/types";

interface ResultsNoticeProps {
  count: number;
  suggestions: DiscoverResponse["suggestions"];
  relatedMoods: string[];
  relaxed: 0 | 1 | 2;
  partial: boolean;
  labels: Partial<Record<FilterKey, string>>;
  onRemove: (key: FilterKey) => void;
}

const note = {
  fontSize: "12px",
  color: "var(--t3)",
  textAlign: "center",
  margin: 0,
} as const;

/**
 * The results page's empty, thin, relaxed and partial notices. Presentational:
 * `onRemove` receives the filter a suggestion loosens.
 */
export default function ResultsNotice({
  count,
  suggestions,
  relatedMoods,
  relaxed,
  partial,
  labels,
  onRemove,
}: ResultsNoticeProps) {
  const empty = count === 0;
  const thin = !empty && suggestions.length > 0;
  const widened = !empty && !thin && relaxed > 0;
  if (!empty && !thin && !widened && !partial) return null;

  const buttons = suggestions.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
      {suggestions.map((s, i) => {
        const primary = empty && i === 0;
        return (
          <button
            key={s.remove}
            type="button"
            onClick={() => onRemove(s.remove)}
            className="font-sans"
            style={{
              padding: "9px 18px",
              borderRadius: "999px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              background: primary ? "var(--gold)" : "none",
              color: primary ? "var(--accent-ink)" : "var(--t1)",
              border: `1px solid ${primary ? "var(--gold)" : "var(--border-h)"}`,
            }}
          >
            {`${labels[s.remove] ?? s.remove} · ${filmCount(s.total)}`}
          </button>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1200px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        marginBottom: "28px",
      }}
    >
      {partial && (
        <p className="font-sans" style={note}>
          One of your moods couldn&apos;t load — showing the other.
        </p>
      )}
      {widened && (
        <p className="font-sans" style={note}>
          Widened a little to find enough films.
        </p>
      )}

      {thin && (
        <>
          <p className="font-sans" style={{ ...note, fontSize: "13px", color: "var(--t2)" }}>
            {`Only ${filmCount(count)} ${count === 1 ? "matches" : "match"}. Loosen one filter:`}
          </p>
          {buttons}
        </>
      )}

      {empty && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "18px",
            padding: "24px 0 8px",
            textAlign: "center",
          }}
        >
          <h2
            className="font-serif"
            style={{
              fontSize: "clamp(26px, 4vw, 36px)",
              fontWeight: 600,
              lineHeight: 1.15,
              color: "var(--t1)",
              margin: 0,
            }}
          >
            Nothing fits all of that.
          </h2>
          {buttons}

          {relatedMoods.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginTop: "12px" }}>
              <p className="font-sans" style={note}>
                Or try a neighbouring mood
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px" }}>
                {relatedMoods.map((key) => {
                  const accent = ACCENT_VARS[moodMap[key]?.accentColor ?? "gold"];
                  return (
                    <Link
                      key={key}
                      href={`/results?mood=${key}&src=related`}
                      className="font-sans"
                      style={{
                        padding: "8px 16px",
                        borderRadius: "999px",
                        fontSize: "12px",
                        fontWeight: 600,
                        textDecoration: "none",
                        color: accent.base,
                        background: accent.soft,
                        border: `1px solid ${accent.border}`,
                      }}
                    >
                      {moodMap[key]?.tagLabel ?? key}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
