import Image from "next/image";
import Link from "next/link";
import { tmdbImageUrl } from "@/lib/tmdb";

interface FilmCardProps {
  id: number;
  title: string;
  posterPath: string | null;
  releaseDate: string;
  voteAverage: number;
  overview: string;
  accentBase?: string;
  /** Why it's here: genre names, the first one emphasised. */
  reason?: string[];
  /** A blend only: one dot per mood the film came from. */
  moodDots?: { color: string; label: string }[];
}

const moodList = new Intl.ListFormat("en-GB", { type: "conjunction" });

export default function FilmCard({
  id,
  title,
  posterPath,
  releaseDate,
  voteAverage,
  overview,
  accentBase,
  reason,
  moodDots,
}: FilmCardProps) {
  const year = releaseDate ? new Date(releaseDate).getFullYear() : "N/A";
  const rating = voteAverage?.toFixed(1) ?? "N/A";
  const accent = accentBase ?? "var(--gold)";

  return (
    <Link
      href={`/film/${id}`}
      className="group film-card-link"
      // `--accent-on-card` is consumed by the CSS hover/focus rule in
      // globals.css to drive the per-card accent without prop-drilling
      // CSS into a className.
      style={
        {
          textDecoration: "none",
          ["--accent-on-card" as string]: accent,
        } as React.CSSProperties
      }
    >
      <div
        className="film-card-frame"
        style={{
          borderRadius: "var(--r)",
          overflow: "hidden",
          background: "var(--surface)",
          border: "1px solid var(--border)",
        }}
      >
        <div
          className="relative"
          style={{ aspectRatio: "2/3", background: "var(--surface2)" }}
        >
          {posterPath ? (
            <Image
              src={tmdbImageUrl(posterPath, "w500") ?? ""}
              alt={title}
              fill
              className="object-cover"
              style={{ transition: "transform var(--t-slow)" }}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ color: "var(--t3)", fontSize: "12px" }}
            >
              No Poster
            </div>
          )}

          {/* The scrim is dark in both themes, so the badge takes dark mode's gold. */}
          <div
            className="always-dark-accents"
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "5px 9px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              lineHeight: 1,
              color: "rgb(var(--gold-rgb))",
              background: "var(--overlay-heavy)",
              border: "1px solid rgba(255,255,255,0.06)",
              boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
              zIndex: 2,
            }}
          >
            ★ {rating}
          </div>

          {moodDots && moodDots.length > 0 && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: "10px",
                left: "10px",
                display: "flex",
                gap: "3px",
                padding: "4px 6px",
                borderRadius: "999px",
                background: "var(--surface)",
                zIndex: 2,
              }}
            >
              {moodDots.map((d) => (
                <span
                  key={d.label}
                  style={{ width: "8px", height: "8px", borderRadius: "50%", background: d.color }}
                />
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "10px 12px 12px", minHeight: "90px" }}>
          <h3
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--t1)",
              margin: 0,
              marginBottom: "6px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h3>
          {moodDots && moodDots.length > 0 && (
            <span className="sr-only">
              {moodDots.length > 1
                ? `Fits ${moodList.format(moodDots.map((d) => d.label))}`
                : `From ${moodDots[0].label}`}
            </span>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--t3)" }}>{year}</span>
          </div>

          {reason && reason.length > 0 && (
            <p style={{ fontSize: "12px", color: "var(--t2)", margin: "4px 0 0" }}>
              <span style={{ color: "var(--t1)", fontWeight: 600 }}>{reason[0]}</span>
              {reason.slice(1).map((g) => ` · ${g}`).join("")}
            </p>
          )}

          <p
            style={{
              fontSize: "11px",
              color: "var(--t2)",
              marginTop: "6px",
              lineHeight: "1.5",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {overview || " "}
          </p>
        </div>
      </div>
    </Link>
  );
}
