import Link from "next/link";
import Image from "next/image";
import type { Film } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/tmdb";

interface FilmRailProps {
  films: Film[];
}

export default function FilmRail({ films }: FilmRailProps) {
  if (films.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: "12px",
        overflowX: "auto",
        paddingBottom: "8px",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      {films.map((film) => {
        const posterUrl = tmdbImageUrl(film.poster_path, "w342");
        const year = film.release_date?.slice(0, 4) ?? "";
        return (
          <Link
            key={film.id}
            href={`/film/${film.id}`}
            style={{
              flexShrink: 0,
              width: "130px",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "100%",
                aspectRatio: "2/3",
                borderRadius: "10px",
                overflow: "hidden",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                position: "relative",
                marginBottom: "6px",
              }}
            >
              {posterUrl ? (
                <Image
                  src={posterUrl}
                  alt={film.title}
                  fill
                  sizes="130px"
                  style={{ objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    color: "var(--t3)",
                  }}
                >
                  No Poster
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--t1)",
                lineHeight: 1.3,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {film.title}
            </div>
            {year && (
              <div style={{ fontSize: "10px", color: "var(--t3)", marginTop: "1px" }}>
                {year}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
