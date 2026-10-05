"use client";

import { ACCENT_VARS } from "@/lib/constants";
import { ERA_OPTIONS, TIME_OPTIONS } from "@/lib/moodFilters";
import { MAX_MOODS, moodMap } from "@/lib/moodMap";
import { resolveMoodText } from "@/lib/moodResolver";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import type { EraKey, TimeKey } from "@/lib/types";

const moodList = new Intl.ListFormat("en-GB", { type: "conjunction" });
const NUDGE = "like funny, dark or cozy";

const chip = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "5px 11px",
  borderRadius: "999px",
  color: "var(--t1)",
  fontWeight: 600,
  fontSize: "12px",
} as const;

interface MoodEchoProps {
  /** Trimmed. */
  text: string;
  /** Tile moods, which come before the text's, as the group route stores them. */
  picked?: string[];
  /** A Time or Era set beside the text beats the text's own, so the echo leaves that one out. */
  time?: TimeKey | null;
  era?: EraKey | null;
}

/** The live reading of describe text, debounced 300 ms in one polite region. */
export default function MoodEcho({ text, picked = [], time = null, era = null }: MoodEchoProps) {
  const shown = useDebouncedValue(text, 300);
  return (
    <p role="status" aria-live="polite" style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--t2)" }}>
      {shown && <Reading text={shown} picked={picked} time={time} era={era} />}
    </p>
  );
}

/** "We'll read that as Need a hug + Need a rush · Before 1990", or why it can't search yet. */
function Reading({ text, picked, time, era }: Required<MoodEchoProps>) {
  const r = resolveMoodText(text);
  const added = r.moodKeys.filter((k) => !picked.includes(k));
  const room = Math.max(0, MAX_MOODS - picked.length);
  const moods = added.slice(0, room);
  const dropped = added.slice(room);
  const filters = [
    !era && r.era && ERA_OPTIONS.find((o) => o.value === r.era)?.label,
    !time && r.time && TIME_OPTIONS.find((o) => o.value === r.time)?.label,
  ].filter((l): l is string => !!l);

  // With a tile picked the text is optional, so a text without a feeling word is fine.
  if (r.moodKeys.length === 0 && picked.length === 0) {
    return r.era || r.time ? (
      <span>Add a feeling word — {NUDGE}.</span>
    ) : (
      <span>
        Nothing in “{text}” matched a mood. Try a feeling word {NUDGE}.
      </span>
    );
  }

  if (moods.length + filters.length + dropped.length + r.unmatched.length === 0) return null;

  const sep = (s: string) => <span aria-hidden="true" style={{ color: "var(--t3)" }}>{s}</span>;

  return (
    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
      {moods.length + filters.length > 0 && <span>We&apos;ll read that as</span>}
      {moods.map((k, i) => {
        const accent = ACCENT_VARS[moodMap[k].accentColor];
        return (
          <span key={k} style={{ display: "contents" }}>
            {i > 0 && sep("+")}
            <span style={{ ...chip, background: accent.soft, border: `1px solid ${accent.border}` }}>
              <span aria-hidden="true" style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent.base }} />
              {moodMap[k].tagLabel}
            </span>
          </span>
        );
      })}
      {filters.map((label, i) => (
        <span key={label} style={{ display: "contents" }}>
          {(moods.length > 0 || i > 0) && sep("·")}
          <span style={{ ...chip, border: "1px solid var(--border-h)" }}>{label}</span>
        </span>
      ))}
      {dropped.length > 0 && (
        <span style={{ flexBasis: "100%" }}>
          {`Two moods at a time — left out ${moodList.format(dropped.map((k) => moodMap[k].tagLabel))}.`}
        </span>
      )}
      {r.unmatched.length > 0 && (
        <span>
          Didn&apos;t recognise:{" "}
          {r.unmatched.map((w, i) => (
            <span key={w}>
              {i > 0 && ", "}
              <span style={{ textDecoration: "line-through" }}>{w}</span>
            </span>
          ))}
          .
        </span>
      )}
    </span>
  );
}
