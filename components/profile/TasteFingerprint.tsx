"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import type { AccentColor } from "@/lib/types";
import Icon from "@/components/ui/Icon";

interface MoodEntry {
  mood: string;
  count: number;
}
interface GenreEntry {
  id: number;
  name: string;
  count: number;
}
interface Fingerprint {
  topMoods: MoodEntry[];
  topGenres: GenreEntry[];
}

// Six-color rotation for the genre chips so they read as distinct categories
// at a glance. The first chip pulls the user's top-mood accent for continuity
// with the hero's "Top mood" line.
const CHIP_ROTATION: AccentColor[] = [
  "violet",
  "blue",
  "rose",
  "gold",
  "teal",
  "ember",
];

function moodLabel(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function moodAccent(key: string): AccentColor {
  return (moodMap[key]?.accentColor ?? "gold") as AccentColor;
}

export default function TasteFingerprint() {
  const { user } = useAuth();
  const [data, setData] = useState<Fingerprint | null>(null);

  useEffect(() => {
    if (!user) {
      setData({ topMoods: [], topGenres: [] });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/fingerprint", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load fingerprint");
        const body: Fingerprint = await res.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setData({ topMoods: [], topGenres: [] });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = data === null;
  const topMoods = data?.topMoods ?? [];
  const topGenres = data?.topGenres ?? [];
  const maxCount = topMoods[0]?.count ?? 0;
  const empty = !isLoading && topMoods.length === 0 && topGenres.length === 0;

  if (empty) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p
            className="font-serif"
            style={{
              fontSize: "16px",
              color: "var(--t1)",
              fontStyle: "italic",
              margin: "0 0 6px",
            }}
          >
            Your fingerprint is still developing.
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--t3)",
              margin: 0,
            }}
          >
            Pick a few moods and save some films — Filmood&apos;s portrait of
            you starts here.
          </p>
        </div>
      </Card>
    );
  }

  // The closing italic line uses the top mood's signature film if known.
  const topMoodKey = topMoods[0]?.mood ?? null;
  const signature = topMoodKey ? moodMap[topMoodKey]?.signatureFilm : null;

  return (
    <>
      <Card>
        <GroupHeader
          accent="gold"
          title="Top moods"
          count={topMoods.length}
          blurb="From your mood picks, ranked"
          glyph="mark"
        />

        {isLoading ? (
          <SkeletonRows count={3} />
        ) : topMoods.length > 0 ? (
          <div className="flex flex-col gap-3">
            {topMoods.map(({ mood, count }) => {
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
              const accent = moodAccent(mood);
              const accentBase = ACCENT_VARS[accent].base;
              return (
                <div key={mood} className="flex items-center gap-3.5">
                  <span style={{ color: accentBase }} className="shrink-0">
                    <Icon name="mark" size={12} />
                  </span>
                  <span
                    style={{
                      width: "120px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--t1)",
                      letterSpacing: "-0.1px",
                    }}
                    className="shrink-0"
                  >
                    {moodLabel(mood)}
                  </span>
                  <div
                    className="flex-1 overflow-hidden rounded-full"
                    style={{ height: "6px", background: "var(--surface2)" }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background: accentBase,
                        borderRadius: "100px",
                        transition: "width 0.5s ease-out",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      width: "30px",
                      textAlign: "right",
                      fontSize: "11px",
                      color: "var(--t3)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(count).padStart(2, "0")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyHint message="No mood picks yet" />
        )}
      </Card>

      <Card>
        <GroupHeader
          accent="blue"
          title="Top genres"
          count={topGenres.length}
          blurb="From your saved films"
        />

        {isLoading ? (
          <SkeletonChips count={5} />
        ) : topGenres.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {topGenres.map((g, i) => {
              const accent = CHIP_ROTATION[i % CHIP_ROTATION.length];
              return (
                <span
                  key={g.id}
                  className="inline-flex items-center gap-1.5"
                  style={{
                    padding: "8px 14px",
                    borderRadius: "100px",
                    background: `var(--${accent}-soft)`,
                    border: `1px solid var(--${accent}-border)`,
                    color: `var(--${accent})`,
                    fontSize: "12.5px",
                    fontWeight: 600,
                    letterSpacing: "-0.1px",
                  }}
                >
                  {g.name}
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      opacity: 0.7,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {String(g.count).padStart(2, "0")}
                  </span>
                </span>
              );
            })}
          </div>
        ) : (
          <EmptyHint message="Save a few films and your top genres will appear here" />
        )}

        {signature && topMoodKey && (
          <p
            className="font-serif"
            style={{
              marginTop: "18px",
              paddingTop: "14px",
              borderTop: "1px solid var(--border)",
              fontSize: "13px",
              color: "var(--t2)",
              fontStyle: "italic",
              letterSpacing: "0.1px",
            }}
          >
            Films like{" "}
            <em style={{ color: "var(--gold)" }}>{signature.title}</em> — your{" "}
            <em style={{ color: ACCENT_VARS[moodAccent(topMoodKey)].base }}>
              {moodLabel(topMoodKey)}
            </em>{" "}
            picks.
          </p>
        )}
      </Card>
    </>
  );
}

// ─── Local building blocks ─────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <article
      className="mb-4 rounded-2xl border p-5.5"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {children}
    </article>
  );
}

function GroupHeader({
  accent,
  title,
  count,
  blurb,
  glyph,
}: {
  accent: AccentColor;
  title: string;
  count: number;
  blurb: string;
  glyph?: "mark";
}) {
  return (
    <div className="mb-3.5 flex items-baseline gap-3">
      {glyph === "mark" && (
        <span style={{ color: `var(--${accent})`, lineHeight: 1 }}>
          <Icon name="mark" size={12} />
        </span>
      )}
      <h3
        className="font-serif"
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--t1)",
          margin: 0,
          letterSpacing: "-0.2px",
        }}
      >
        {title}
      </h3>
      {count > 0 && (
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "1px",
            color: "var(--t3)",
          }}
        >
          {String(count).padStart(2, "0")}
        </span>
      )}
      <span
        aria-hidden
        className="flex-1"
        style={{
          height: "1px",
          background: `linear-gradient(to right, var(--${accent}-border), transparent)`,
        }}
      />
      <span
        className="hidden sm:inline"
        style={{
          fontSize: "10px",
          fontStyle: "italic",
          color: "var(--t3)",
        }}
      >
        {blurb}
      </span>
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5">
          <div className="search-skeleton-bar h-3 w-3 shrink-0 rounded-sm" />
          <div className="search-skeleton-bar h-3 w-30 shrink-0 rounded-sm" />
          <div className="search-skeleton-bar h-1.5 flex-1 rounded-full" />
          <div className="search-skeleton-bar h-3 w-7 rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function SkeletonChips({ count }: { count: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="search-skeleton-bar"
          style={{
            height: "32px",
            width: `${70 + (i % 3) * 18}px`,
            borderRadius: "100px",
          }}
        />
      ))}
    </div>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <p style={{ fontSize: "12px", color: "var(--t3)", margin: 0 }}>{message}</p>
  );
}
