"use client";

import { useEffect, useState } from "react";
import { allMoods } from "@/lib/moodMap";
import { useMediaQuery } from "@/lib/useMediaQuery";
import CollapsedBoxRail from "./CollapsedBoxRail";

const MOOD_COUNT = allMoods.length;

// Editorial reel: cycles one featured mood at a time. Order curated by emotional variety.
const FEATURED_KEYS = ["unsettled", "laugh", "beautiful", "cry", "easy", "thrilling", "inspiring", "mindbending"];
const featuredMoods = FEATURED_KEYS
  .map((k) => allMoods.find((m) => m.key === k))
  .filter((m): m is (typeof allMoods)[number] => !!m);

interface MoodBoxProps {
  onExpand: () => void;
  isExpanded: boolean;
  isCollapsed?: boolean;
}

export default function MoodBox({
  onExpand,
  isExpanded,
  isCollapsed,
}: MoodBoxProps) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion || isCollapsed) return;
    let swap: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setFading(true);
      swap = setTimeout(() => {
        setFeaturedIndex((i) => (i + 1) % featuredMoods.length);
        setFading(false);
      }, 400);
    }, 4800);
    return () => {
      clearInterval(id);
      clearTimeout(swap);
    };
  }, [prefersReducedMotion, isCollapsed]);

  const featured = featuredMoods[featuredIndex];
  const featuredAccent = `var(--${featured.accentColor})`;
  const featuredAccentRgb = `var(--${featured.accentColor}-rgb)`;
  if (isCollapsed) {
    return (
      <CollapsedBoxRail
        label="What to watch"
        title="Pick your mood"
        sub="Select how you want to feel — we'll find the film."
        accent="var(--gold)"
        accentSoft="var(--gold-soft)"
        ariaLabel="Pick your mood — select how you want to feel"
        onActivate={onExpand}
      />
    );
  }

  return (
    <section
      role="button"
      tabIndex={0}
      onClick={onExpand}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      aria-expanded={isExpanded}
      aria-label="Pick your mood — select how you want to feel"
      className="relative overflow-hidden cursor-pointer"
      style={{
        background: "var(--surface)",
        border: `1px solid ${isExpanded ? "var(--gold)" : "var(--border)"}`,
        borderRadius: "16px",
        padding: "22px",
        transition: "border-color 0.3s, box-shadow 0.3s",
        boxShadow: isExpanded
          ? "0 0 0 1px var(--gold), 0 0 16px var(--gold-glow)"
          : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Label */}
      <div
        style={{
          fontSize: "10px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "1.8px",
          color: "var(--gold)",
          marginBottom: "12px",
        }}
      >
        What to watch
      </div>

      {/* Heading */}
      <h2
        className="font-serif"
        style={{
          fontSize: "clamp(20px, 2.2vw, 26px)",
          fontWeight: 600,
          color: "var(--t1)",
          lineHeight: 1.2,
          marginBottom: "6px",
        }}
      >
        Pick your mood
      </h2>

      {/* Subtext */}
      <p style={{ fontSize: "13px", color: "var(--t2)", lineHeight: 1.55, marginBottom: "18px" }}>
        {MOOD_COUNT} flavors, one film.
        <br />
        Tell us how you want to feel — we&apos;ll do the rest.
      </p>

      {/* Featured mood — editorial, rotating. Not clickable individually; box click opens panel. */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          borderRadius: "12px",
          background: `rgba(${featuredAccentRgb}, 0.06)`,
          border: `1px solid rgba(${featuredAccentRgb}, 0.18)`,
          padding: "14px 16px",
          marginBottom: "14px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Accent stripe */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            width: 3,
            background: featuredAccent,
            opacity: 0.55,
          }}
        />
        <div
          style={{
            fontSize: 9.5,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: featuredAccent,
            marginBottom: 6,
            opacity: fading ? 0 : 1,
            transition: "opacity 0.4s, color 0.8s",
          }}
        >
          Tonight, maybe
        </div>
        <div
          className="font-serif"
          style={{
            fontSize: 19,
            fontWeight: 500,
            fontStyle: "italic",
            color: "var(--t1)",
            lineHeight: 1.15,
            marginBottom: 4,
            opacity: fading ? 0 : 1,
            transform: fading ? "translateY(4px)" : "translateY(0)",
            transition: "opacity 0.4s, transform 0.4s",
          }}
        >
          {featured.label}.
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--t3)",
            lineHeight: 1.4,
            opacity: fading ? 0 : 0.9,
            transition: "opacity 0.4s",
          }}
        >
          {featured.description}
        </div>
      </div>

      {/* Open-the-board CTA — pinned to the bottom of the box */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onExpand();
        }}
        className="flex w-full items-center justify-center gap-1.5 cursor-pointer"
        style={{
          marginTop: "auto",
          padding: "11px",
          borderRadius: "10px",
          background: "var(--gold-soft)",
          border: "1px solid rgba(var(--gold-rgb), 0.22)",
          color: "var(--gold)",
          fontSize: "12.5px",
          fontWeight: 600,
          letterSpacing: "0.2px",
          transition: "all 0.25s",
        }}
      >
        <span>Open the mood board</span>
        <span
          style={{
            fontSize: "11px",
            transition: "transform 0.3s",
            transform: isExpanded ? "rotate(180deg)" : "none",
            display: "inline-block",
          }}
        >
          ↓
        </span>
      </button>
    </section>
  );
}
