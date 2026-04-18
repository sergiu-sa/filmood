"use client";

import { useState } from "react";

interface CollapsedBoxRailProps {
  label: string;
  title: string;
  sub: string;
  accent: string;
  accentSoft: string;
  ariaLabel: string;
  onActivate: () => void;
}

// Compact sibling rail shown on desktop when a different panel is active.
// Keeps the outer <section> semantics (role=button, aria-expanded=false,
// keyboard activation) so assistive tech sees it as a tab-like control.
export default function CollapsedBoxRail({
  label,
  title,
  sub,
  accent,
  accentSoft,
  ariaLabel,
  onActivate,
}: CollapsedBoxRailProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onActivate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
      aria-expanded={false}
      aria-label={ariaLabel}
      className="relative overflow-hidden cursor-pointer"
      style={{
        background: hovered ? accentSoft : "var(--surface)",
        border: `1px solid ${hovered ? accent : "var(--border)"}`,
        borderRadius: "16px",
        padding: "22px 18px",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        transition: "background 0.25s ease, border-color 0.25s ease",
      }}
    >
      {/* Left-edge accent bar — anchors the rail visually to its mood/color */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "3px",
          background: accent,
          opacity: hovered ? 0.85 : 0.45,
          transition: "opacity 0.25s ease",
        }}
      />

      {/* Top label */}
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1.8px",
          color: accent,
          marginBottom: "14px",
        }}
      >
        {label}
      </div>

      {/* Title (serif) */}
      <h2
        className="font-serif"
        style={{
          fontSize: "clamp(16px, 1.6vw, 20px)",
          fontWeight: 600,
          color: "var(--t1)",
          lineHeight: 1.2,
          marginBottom: "8px",
          overflowWrap: "anywhere",
        }}
      >
        {title}
      </h2>

      {/* Short description */}
      <p
        style={{
          fontSize: "12px",
          color: "var(--t3)",
          lineHeight: 1.45,
        }}
      >
        {sub}
      </p>

      {/* Flexible spacer so the expand cue sits at the bottom */}
      <div style={{ flex: 1, minHeight: "16px" }} />

      {/* Expand cue */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "1.8px",
            textTransform: "uppercase",
            color: "var(--t3)",
          }}
        >
          Expand
        </span>
        <span
          aria-hidden
          style={{
            fontSize: "14px",
            color: accent,
            transition: "transform 0.25s ease",
            transform: hovered ? "translateX(3px)" : "none",
          }}
        >
          →
        </span>
      </div>
    </section>
  );
}
