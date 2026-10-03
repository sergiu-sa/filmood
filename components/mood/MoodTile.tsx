import Link from "next/link";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import Icon from "@/components/ui/Icon";

interface MoodTileProps {
  moodKey: string;
  href: string;
  /** full: the home panel (arrow, "like <signature film>", 128px tall). compact: popovers, neighbouring moods, the mobile sheet. */
  variant?: "compact" | "full";
}

/** A mood as a link: accent dot, title in the user's voice, one-liner. */
export default function MoodTile({ moodKey, href, variant = "compact" }: MoodTileProps) {
  if (!Object.hasOwn(moodMap, moodKey)) return null;
  const mood = moodMap[moodKey];
  const accent = ACCENT_VARS[mood.accentColor];
  const full = variant === "full";

  const dot = (
    <span aria-hidden="true" style={{ width: "9px", height: "9px", borderRadius: "50%", background: accent.base }} />
  );

  return (
    <Link
      href={href}
      aria-label={`${mood.tagLabel} — ${mood.description}`}
      className="mood-tile font-sans"
      // The --tile-* variables feed the .mood-tile hover/focus rule in globals.css.
      style={
        {
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          minHeight: full ? "128px" : "44px",
          boxSizing: "border-box",
          padding: full ? "16px 16px 14px" : "16px",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          borderRadius: "14px",
          textDecoration: "none",
          color: "var(--t1)",
          ["--tile-accent" as string]: accent.base,
          ["--tile-soft" as string]: accent.soft,
        } as React.CSSProperties
      }
    >
      {full ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {dot}
          <span className="mood-tile-arrow" style={{ display: "inline-flex", color: "var(--t3)" }}>
            <Icon name="arrow-right" size={16} />
          </span>
        </span>
      ) : (
        dot
      )}
      <span className="font-serif" style={{ fontSize: full ? "20px" : "19px", fontWeight: 600, lineHeight: full ? 1.2 : undefined, marginTop: "4px" }}>
        {mood.tagLabel}
      </span>
      <span style={{ fontSize: "13px", lineHeight: full ? 1.4 : undefined, color: "var(--t2)" }}>{mood.description}</span>
      {full && mood.signatureFilm && (
        <span
          className="mood-tile-hint font-serif"
          style={{ marginTop: "auto", fontSize: "12.5px", fontStyle: "italic", color: "var(--t3)" }}
        >
          like {mood.signatureFilm.title}
        </span>
      )}
    </Link>
  );
}
