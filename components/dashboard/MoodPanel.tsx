"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { allMoods, MAX_MOODS } from "@/lib/moodMap";
import type { EraKey, TempoKey } from "@/lib/types";
import MoodCard from "./MoodCard";
import MoodExtras from "@/components/mood/MoodExtras";
import { LEGACY_TEMPO_TIME } from "@/lib/moodFilters";

interface MoodPanelProps {
  isOpen: boolean;
  selectedMoods: Set<string>;
  onSelectMood: (key: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

export default function MoodPanel({
  isOpen,
  selectedMoods,
  onSelectMood,
  onClose,
  embedded,
}: MoodPanelProps) {
  const router = useRouter();
  const count = selectedMoods.size;

  const [era, setEra] = useState<EraKey | null>(null);
  const [tempo, setTempo] = useState<TempoKey | null>(null);
  const [moodText, setMoodText] = useState("");

  const trimmedText = moodText.trim();
  const canSubmit = count > 0 || trimmedText.length > 0;

  const handleFindFilms = () => {
    if (!canSubmit) return;

    const params = new URLSearchParams();
    if (count > 0) params.set("mood", Array.from(selectedMoods).join(","));

    if (era) params.set("era", era);
    // Tempo was always runtime; send the Time it stands for.
    if (tempo) params.set("time", LEGACY_TEMPO_TIME[tempo]);
    if (trimmedText) params.set("text", trimmedText);

    router.push(`/results?${params.toString()}`);
  };

  const content = (
    <>
      {/* Panel label */}
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1.8px",
          color: "var(--gold)",
          marginBottom: "16px",
        }}
      >
        All moods · pick up to {MAX_MOODS}
      </div>

      {/* Full mood grid */}
      <div className="grid grid-cols-2 gap-2 mb-4 sm:grid-cols-3 min-[900px]:grid-cols-4">
        {allMoods.map((mood) => (
          <MoodCard
            key={mood.key}
            moodKey={mood.key}
            tagLabel={mood.tagLabel}
            label={mood.label}
            description={mood.description}
            accentColor={mood.accentColor}
            isSelected={selectedMoods.has(mood.key)}
            onSelect={onSelectMood}
            disabled={count >= MAX_MOODS && !selectedMoods.has(mood.key)}
          />
        ))}
      </div>

      {/* Era + tempo + free-form text */}
      <div style={{ marginBottom: "14px" }}>
        <MoodExtras
          era={era}
          tempo={tempo}
          text={moodText}
          onEraChange={setEra}
          onTempoChange={setTempo}
          onTextChange={setMoodText}
        />
      </div>

      {/* Action row */}
      <div
        className="flex items-center gap-2.5 flex-wrap"
        style={{ borderTop: "1px solid var(--border)", paddingTop: "14px", marginTop: "10px" }}
      >
        {canSubmit && (
          <button
            onClick={handleFindFilms}
            className="cursor-pointer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 20px",
              borderRadius: "10px",
              background: "var(--gold)",
              color: "var(--accent-ink)",
              fontSize: "13px",
              fontWeight: 600,
              lineHeight: 1,
              border: "none",
              transition: "all 0.25s",
            }}
          >
            Find films →
          </button>
        )}

        <button
          onClick={onClose}
          className="btn-panel-outline cursor-pointer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "9px 18px",
            borderRadius: "10px",
            background: "none",
            color: "var(--t1)",
            fontSize: "13px",
            fontWeight: 500,
            lineHeight: 1,
            border: "1px solid var(--border-h)",
            transition: "all 0.25s",
          }}
        >
          Close
        </button>

        <span className="ml-auto" style={{ fontSize: "12px", color: "var(--t3)" }}>
          {count > 0
            ? `${count} mood${count > 1 ? "s" : ""} selected${trimmedText ? " + description" : ""}`
            : trimmedText
              ? "Describing your mood"
              : "Select your moods, then find films"}
        </span>
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div
      style={{
        maxHeight: isOpen ? "1200px" : "0",
        opacity: isOpen ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s, padding 0.4s",
        paddingBottom: isOpen ? "10px" : "0",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "22px",
        }}
      >
        {content}
      </div>
    </div>
  );
}
