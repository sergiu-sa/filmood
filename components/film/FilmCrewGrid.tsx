import type { CrewMember } from "@/lib/types";

interface FilmCrewGridProps {
  crew: CrewMember[];
}

/**
 * Auto-fill grid of crew credits (Director / Writer / DP / Composer / …).
 * Each cell is a job-label + name pair; the page's parent already filters
 * + sorts the crew list before passing it in.
 */
export default function FilmCrewGrid({ crew }: FilmCrewGridProps) {
  if (!crew || crew.length === 0) return null;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "10px 18px",
      }}
    >
      {crew.map((m) => (
        <div
          key={`${m.id}-${m.job}`}
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "8px 0",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: "var(--t2)",
              marginBottom: "2px",
            }}
          >
            {m.job}
          </span>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--t1)",
            }}
          >
            {m.name}
          </span>
        </div>
      ))}
    </div>
  );
}
