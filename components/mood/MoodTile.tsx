import Link from "next/link";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";

/** A mood as a link: accent dot, title in the user's voice, one-liner. */
export default function MoodTile({ moodKey, href }: { moodKey: string; href: string }) {
  if (!Object.hasOwn(moodMap, moodKey)) return null;
  const mood = moodMap[moodKey];

  return (
    <Link
      href={href}
      aria-label={`${mood.tagLabel} — ${mood.description}`}
      className="font-sans"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        minHeight: "44px",
        boxSizing: "border-box",
        padding: "16px",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: "14px",
        textDecoration: "none",
        color: "var(--t1)",
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: "9px", height: "9px", borderRadius: "50%", background: ACCENT_VARS[mood.accentColor].base }}
      />
      <span className="font-serif" style={{ fontSize: "19px", fontWeight: 600, marginTop: "4px" }}>
        {mood.tagLabel}
      </span>
      <span style={{ fontSize: "13px", color: "var(--t2)" }}>{mood.description}</span>
    </Link>
  );
}
