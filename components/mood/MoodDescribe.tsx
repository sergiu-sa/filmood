"use client";

import { useId, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import MoodEcho from "@/components/mood/MoodEcho";
import { MAX_TEXT_LENGTH, resolveMoodText } from "@/lib/moodResolver";

/** "Or describe it": free text, a live reading of it, and a submit that goes to results. */
export default function MoodDescribe({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [text, setText] = useState("");
  const trimmed = text.trim();
  // The current text, not the debounced one, so Enter never waits on the echo.
  const canSubmit = trimmed !== "" && resolveMoodText(trimmed).moodKeys.length > 0;

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
      <MoodEcho text={trimmed} />
    </form>
  );
}
