import Link from "next/link";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import Icon from "@/components/ui/Icon";

type MoodTileProps = {
  moodKey: string;
  /** full: the home panel (arrow, "like <signature film>", 128px tall). compact: popovers, neighbouring moods, the mobile sheet, the group page. */
  variant?: "compact" | "full";
} & ({ href: string } | { pressed: boolean; onToggle: (key: string) => void });

/** A mood as a link, or as a toggle button: accent dot, title in the user's voice, one-liner. */
export default function MoodTile(props: MoodTileProps) {
  const { moodKey, variant = "compact" } = props;
  if (!Object.hasOwn(moodMap, moodKey)) return null;
  const mood = moodMap[moodKey];
  const accent = ACCENT_VARS[mood.accentColor];
  const full = variant === "full";
  const toggle = "onToggle" in props;
  const pressed = toggle && props.pressed;

  const dot = (
    <span aria-hidden="true" style={{ width: "9px", height: "9px", borderRadius: "50%", background: accent.base }} />
  );

  const style = {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minHeight: full ? "128px" : "44px",
    boxSizing: "border-box",
    padding: full ? "16px 16px 14px" : "16px",
    background: pressed ? accent.soft : "var(--surface2)",
    border: pressed ? `1.5px solid ${accent.base}` : "1px solid var(--border)",
    borderRadius: "14px",
    textDecoration: "none",
    color: "var(--t1)",
    // The --tile-* variables feed the .mood-tile hover/focus rule in globals.css.
    ["--tile-accent" as string]: accent.base,
    ["--tile-soft" as string]: accent.soft,
  } as React.CSSProperties;

  const content = (
    <>
      {toggle ? (
        // A fixed-height row, so the check appearing doesn't push the tile's text down.
        <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: "22px" }}>
          {dot}
          {pressed && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "22px",
                height: "22px",
                borderRadius: "50%",
                background: accent.base,
                color: "var(--bg)",
              }}
            >
              <Icon name="check" size={13} />
            </span>
          )}
        </span>
      ) : full ? (
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
    </>
  );

  const name = `${mood.tagLabel} — ${mood.description}`;

  if (toggle) {
    return (
      <button
        type="button"
        aria-pressed={props.pressed}
        aria-label={name}
        onClick={() => props.onToggle(moodKey)}
        className="mood-tile font-sans"
        style={{
          ...style,
          width: "100%",
          textAlign: "left",
          cursor: "pointer",
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link href={props.href} aria-label={name} className="mood-tile font-sans" style={style}>
      {content}
    </Link>
  );
}
