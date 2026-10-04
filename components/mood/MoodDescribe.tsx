"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import { ACCENT_VARS } from "@/lib/constants";
import { ERA_OPTIONS, TIME_OPTIONS } from "@/lib/moodFilters";
import { MAX_MOODS, moodMap } from "@/lib/moodMap";
import { MAX_TEXT_LENGTH, resolveMoodText } from "@/lib/moodResolver";
import { useDebouncedValue } from "@/lib/useDebouncedValue";

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

/** "Or describe it": free text, a live reading of it, and a submit that goes to results. Home only for now. */
export default function MoodDescribe({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("");
  const trimmed = text.trim();
  // The current text, not the debounced one, so Enter never waits on the echo.
  const canSubmit = trimmed !== "" && resolveMoodText(trimmed).moodKeys.length > 0;
  const shown = useDebouncedValue(trimmed, 300);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    router.push(`/results?${new URLSearchParams({ text: trimmed, src: "text" })}`);
  };

  return (
    <form onSubmit={submit} className="font-sans" style={{ display: "flex", flexDirection: "column", gap: compact ? "8px" : "10px" }}>
      <label htmlFor={id} style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.4px", color: "var(--t2)" }}>
        Or describe it in your own words
      </label>
      <div style={{ display: "flex", gap: compact ? "8px" : "10px" }}>
        <input
          id={id}
          className="mood-describe-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={MAX_TEXT_LENGTH}
          placeholder="e.g. cozy 80s heist"
          style={{
            flexGrow: 1,
            minWidth: 0,
            boxSizing: "border-box",
            height: compact ? "48px" : "52px",
            padding: compact ? "0 14px" : "0 16px",
            background: "var(--surface2)",
            border: "1px solid var(--border-h)",
            borderRadius: "12px",
            font: "inherit",
            fontSize: "15px",
            color: "var(--t1)",
          }}
        />
        <button
          type="submit"
          aria-label={compact ? "Show films" : undefined}
          aria-disabled={!canSubmit}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            flexShrink: 0,
            width: compact ? "48px" : undefined,
            height: compact ? "48px" : "52px",
            padding: compact ? 0 : "0 22px",
            border: "none",
            borderRadius: "12px",
            background: "var(--gold)",
            color: "var(--accent-ink)",
            font: "inherit",
            fontSize: "14px",
            fontWeight: 700,
            cursor: canSubmit ? "pointer" : "not-allowed",
            opacity: canSubmit ? 1 : 0.5,
          }}
        >
          {!compact && "Show films"}
          <Icon name="arrow-right" size={compact ? 18 : 16} />
        </button>
      </div>
      <p role="status" aria-live="polite" style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--t2)" }}>
        {shown && <Reading text={shown} />}
      </p>
    </form>
  );
}

/** "We'll read that as Need a hug + Need a rush · Before 1990", or why it can't search yet. */
function Reading({ text }: { text: string }) {
  const r = resolveMoodText(text);
  const moods = r.moodKeys.slice(0, MAX_MOODS);
  const dropped = r.moodKeys.slice(MAX_MOODS);
  const filters = [
    r.era && ERA_OPTIONS.find((o) => o.value === r.era)?.label,
    r.time && TIME_OPTIONS.find((o) => o.value === r.time)?.label,
  ].filter((l): l is string => !!l);

  if (moods.length === 0) {
    return filters.length > 0 ? (
      <span>Add a feeling word — {NUDGE}.</span>
    ) : (
      <span>
        Nothing in “{text}” matched a mood. Try a feeling word {NUDGE}.
      </span>
    );
  }

  const sep = (s: string) => <span aria-hidden="true" style={{ color: "var(--t3)" }}>{s}</span>;

  return (
    <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px" }}>
      <span>We&apos;ll read that as</span>
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
      {filters.map((label) => (
        <span key={label} style={{ display: "contents" }}>
          {sep("·")}
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
