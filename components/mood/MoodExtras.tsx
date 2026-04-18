"use client";

// Shared refinement block rendered under the mood grid on both the single-user
// dashboard and the group mood page. Stateless: parent owns the values and
// passes callbacks. Uses the shared chipStyle helper.

import type { EraKey, TempoKey } from "@/lib/types";
import { ERA_OPTIONS, TEMPO_OPTIONS } from "@/lib/moodRefinements";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { chipStyle, FieldLabel } from "./chipStyle";

interface Props {
  era: EraKey | null;
  tempo: TempoKey | null;
  text: string;
  onEraChange: (era: EraKey | null) => void;
  onTempoChange: (tempo: TempoKey | null) => void;
  onTextChange: (text: string) => void;
  /**
   * When true, blocks interaction via pointer events only. Parents that already
   * dim a surrounding wrapper should leave this false to avoid opacity stacking.
   */
  disabled?: boolean;
  /** Optional label override for the text input placeholder. */
  textPlaceholder?: string;
}

export default function MoodExtras({
  era,
  tempo,
  text,
  onEraChange,
  onTempoChange,
  onTextChange,
  disabled = false,
  textPlaceholder = "Or describe it — e.g. \"cozy 80s heist\", \"slow-burn noir\"",
}: Props) {
  const isWide = useMediaQuery("(min-width: 640px)");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        padding: "16px",
        background: "var(--surface2)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isWide ? "1fr 1fr" : "1fr",
          gap: "16px",
        }}
      >
        <div>
          <FieldLabel>Era</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {ERA_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onEraChange(era === opt.value ? null : opt.value)}
                className="cursor-pointer font-sans"
                style={chipStyle(era === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Tempo</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {TEMPO_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onTempoChange(tempo === opt.value ? null : opt.value)}
                className="cursor-pointer font-sans"
                style={chipStyle(tempo === opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <FieldLabel>Describe your mood (optional)</FieldLabel>
        <input
          type="text"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={textPlaceholder}
          maxLength={120}
          className="font-sans w-full"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            padding: "10px 14px",
            fontSize: "13px",
            color: "var(--t1)",
            outline: "none",
            transition: "border-color 0.2s, box-shadow 0.2s",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--blue)";
            e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-soft)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.boxShadow = "none";
          }}
        />
      </div>
    </div>
  );
}
