import { useId } from "react";
import MoodTile from "@/components/mood/MoodTile";
import Icon from "@/components/ui/Icon";
import { filmCount } from "@/lib/filmCount";
import type { FilterKey } from "@/lib/moodFilters";
import type { AppliedFilters, DiscoverResponse, EraKey, TimeKey, WhereKey } from "@/lib/types";

interface ResultsNoticeProps {
  count: number;
  moods: DiscoverResponse["moods"];
  filters: AppliedFilters;
  suggestions: DiscoverResponse["suggestions"];
  relatedMoods: string[];
  relaxed: 0 | 1 | 2;
  partial: boolean;
  labels: Partial<Record<FilterKey, string>>;
  onRemove: (key: FilterKey) => void;
}

const ERA_CLAUSE: Record<EraKey, string> = {
  classic: "from before 1990",
  modern: "from 1990–2009",
  fresh: "from 2010 on",
};
const TIME_CLAUSE: Record<TimeKey, string> = {
  short: "under 100 minutes",
  medium: "under 2 hours",
  long: "at 2 h 20 or longer",
};
const WHERE_CLAUSE: Record<WhereKey, string | null> = {
  mine: "on your services",
  norway: "streaming in Norway",
  any: null,
};

/** "Nothing for Date night from before 1990, under 100 minutes, on your services right now." */
export function describeAsk(moods: DiscoverResponse["moods"], filters: AppliedFilters): string {
  const clauses = [
    filters.era && ERA_CLAUSE[filters.era],
    filters.time && TIME_CLAUSE[filters.time],
    WHERE_CLAUSE[filters.where],
  ].filter(Boolean);
  const names = moods.map((m) => m.label).join(" + ");
  return `Nothing for ${names}${clauses.length > 0 ? ` ${clauses.join(", ")}` : ""} right now.`;
}

const note = { fontSize: "12.5px", color: "var(--t2)", margin: 0 } as const;

/**
 * The results page's empty, thin, relaxed and partial notices. Presentational:
 * `onRemove` receives the filter a suggestion loosens.
 */
export default function ResultsNotice({
  count,
  moods,
  filters,
  suggestions,
  relatedMoods,
  relaxed,
  partial,
  labels,
  onRemove,
}: ResultsNoticeProps) {
  const headingId = useId();
  const empty = count === 0;
  const thin = !empty && suggestions.length > 0;
  const widened = !empty && !thin && relaxed > 0;
  if (!empty && !thin && !widened && !partial) return null;

  const buttons = suggestions.length > 0 && (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: empty ? "center" : "flex-start", gap: "10px" }}>
      {suggestions.map((s, i) => {
        const primary = empty && i === 0;
        return (
          <button
            key={s.remove}
            type="button"
            onClick={() => onRemove(s.remove)}
            className="font-sans"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              minHeight: empty ? "46px" : "44px",
              boxSizing: "border-box",
              padding: empty ? "0 18px" : "0 16px",
              borderRadius: "12px",
              fontSize: empty ? "14px" : "13.5px",
              fontWeight: primary ? 700 : 600,
              cursor: "pointer",
              background: primary ? "var(--gold)" : "var(--surface2)",
              color: primary ? "var(--accent-ink)" : "var(--t1)",
              border: primary ? "1px solid var(--gold)" : "1px solid var(--border-h)",
            }}
          >
            {labels[s.remove] ?? s.remove}{" "}
            <span style={{ fontWeight: 500, color: primary ? undefined : "var(--t2)" }}>
              · {filmCount(s.total)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
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
        <section
          aria-labelledby={headingId}
          className="font-sans"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px 24px",
            boxSizing: "border-box",
            padding: "20px 24px",
            background: "var(--surface)",
            border: "1px solid var(--border-h)",
            borderRadius: "16px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2
              id={headingId}
              className="font-serif"
              style={{ margin: 0, fontSize: "21px", fontWeight: 600, color: "var(--t1)" }}
            >
              {`Only ${filmCount(count)} ${count === 1 ? "matches" : "match"} all of that.`}
            </h2>
            <p style={{ margin: 0, fontSize: "14px", color: "var(--t2)" }}>Loosen one filter to see more.</p>
          </div>
          {buttons}
        </section>
      )}

      {empty && (
        <section
          aria-labelledby={headingId}
          className="font-sans"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 0 8px" }}
        >
          <div
            style={{
              maxWidth: "720px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "14px",
              textAlign: "center",
              color: "var(--t2)",
            }}
          >
            <Icon name="clapper" size={44} />
            <h2
              id={headingId}
              className="font-serif"
              style={{
                margin: 0,
                fontSize: "clamp(26px, 4vw, 32px)",
                fontWeight: 600,
                lineHeight: 1.15,
                color: "var(--t1)",
              }}
            >
              Nothing fits all of that.
            </h2>
            <p style={{ margin: 0, fontSize: "15px", lineHeight: 1.6 }}>
              {describeAsk(moods, filters)}
              {suggestions.length > 0 && " Loosen one filter:"}
            </p>
            {buttons && <div style={{ marginTop: "6px" }}>{buttons}</div>}
          </div>

          {relatedMoods.length > 0 && (
            <div
              style={{
                width: "100%",
                maxWidth: "900px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                marginTop: "48px",
              }}
            >
              <h3
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  margin: 0,
                  fontSize: "12px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "var(--t2)",
                }}
              >
                <span aria-hidden="true" style={{ flexGrow: 1, height: "1px", background: "var(--border-h)" }} />
                Or try a neighbouring mood
                <span aria-hidden="true" style={{ flexGrow: 1, height: "1px", background: "var(--border-h)" }} />
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "12px" }}>
                {relatedMoods.map((key) => (
                  <MoodTile key={key} moodKey={key} href={`/results?mood=${key}&src=related`} />
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
