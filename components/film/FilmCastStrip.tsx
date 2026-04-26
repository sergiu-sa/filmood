import Image from "next/image";
import { tmdbImageUrl } from "@/lib/tmdb";

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

interface FilmCastStripProps {
  cast: CastMember[];
}

/**
 * Horizontal-scrolling avatar strip for the film detail page's cast
 * section. Wrapped in `.fd-scroll-fade` so the right edge fades into
 * the page background as a scroll-affordance (CSS lives in the page's
 * inline `<style>` block).
 */
export default function FilmCastStrip({ cast }: FilmCastStripProps) {
  if (!cast || cast.length === 0) return null;
  return (
    <div className="fd-scroll-fade">
      <div className="fd-cast-scroll">
        {cast.map((actor) => (
          <div
            key={actor.id}
            style={{
              flexShrink: 0,
              width: "90px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                margin: "0 auto 8px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {actor.profile_path ? (
                <Image
                  src={tmdbImageUrl(actor.profile_path, "w185") ?? ""}
                  alt={actor.name}
                  fill
                  sizes="72px"
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
                    color: "var(--t3)",
                    fontSize: "16px",
                  }}
                >
                  ?
                </div>
              )}
            </div>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--t1)",
                marginBottom: "2px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                transition: "color 0.2s",
              }}
            >
              {actor.name}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--t3)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {actor.character}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
