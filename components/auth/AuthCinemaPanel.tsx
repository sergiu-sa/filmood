"use client";

import Link from "next/link";
import { useDynamicBackdrop } from "@/lib/useDynamicBackdrop";

const MOOD_PILLS = [
  { label: "Cozy and warm", color: "rgba(var(--gold-rgb), 0.7)", border: "var(--gold-border)" },
  { label: "On the edge", color: "rgba(var(--ember-rgb), 0.7)", border: "var(--ember-border)" },
  { label: "Mind-bending", color: "rgba(var(--blue-rgb), 0.7)", border: "var(--blue-border)" },
  { label: "Butterflies", color: "rgba(var(--rose-rgb), 0.7)", border: "var(--rose-border)" },
  { label: "Deeply moved", color: "rgba(var(--violet-rgb), 0.7)", border: "var(--violet-border)" },
  { label: "Easy and light", color: "rgba(var(--teal-rgb), 0.7)", border: "var(--teal-border)" },
];

/**
 * The cinematic left half shared by every auth page. `always-dark-accents` is required here:
 *  the TMDB backdrop underneath is dark in both themes, so light-mode accent values would read muddy on top of it.
 */
export default function AuthCinemaPanel() {
  const { current, next, fading } = useDynamicBackdrop();

  return (
    <div className="always-dark-accents hidden lg:flex flex-col justify-end flex-1 relative overflow-hidden p-12">
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-800"
        style={{ backgroundImage: `url('${current}')`, opacity: fading ? 0 : 1 }}
      />

      {/* Next backdrop pre-loaded underneath so the crossfade has no blank frame */}
      {next && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url('${next}')`, opacity: 1, zIndex: -1 }}
        />
      )}

      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(10,10,12,0.94) 0%, rgba(10,10,12,0.45) 50%, rgba(10,10,12,0.18) 100%)",
          zIndex: 1,
        }}
      />

      <div className="relative z-10">
        <Link
          href="/"
          className="font-serif block mb-8 no-underline"
          style={{
            fontSize: "28px",
            fontWeight: 600,
            color: "var(--accent-paper)",
            letterSpacing: "-0.3px",
          }}
        >
          Filmood
        </Link>
        <div
          className="mb-3 text-[11px] font-medium uppercase tracking-[1.5px]"
          style={{ color: "rgba(240,239,232,0.4)" }}
        >
          How films should be found
        </div>
        <div
          className="font-serif mb-5 text-2xl italic leading-relaxed"
          style={{ color: "rgba(240,239,232,0.9)", maxWidth: "360px" }}
        >
          What do you feel like watching tonight?
        </div>
        <div className="flex flex-wrap gap-2">
          {MOOD_PILLS.map((pill) => (
            <span
              key={pill.label}
              className="rounded-full px-4 py-1.5 text-xs font-medium"
              style={{
                border: `1px solid ${pill.border}`,
                color: pill.color,
                background: "rgba(255,255,255,0.03)",
              }}
            >
              {pill.label}
            </span>
          ))}
        </div>
        <p
          className="mt-5 text-xs leading-relaxed"
          style={{ color: "rgba(240,239,232,0.3)" }}
        >
          Join Filmood and discover films that match your mood, not just your
          search.
        </p>
      </div>
    </div>
  );
}
