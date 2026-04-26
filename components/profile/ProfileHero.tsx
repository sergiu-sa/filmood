"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { moodMap } from "@/lib/moodMap";
import { ACCENT_VARS } from "@/lib/constants";
import type { AccentColor } from "@/lib/types";
import Icon from "@/components/ui/Icon";

interface Props {
  user: User;
}

interface Stats {
  watchlistCount: number;
  moodPicks: number;
  topMood: string | null;
  sessionsJoined: number;
}

function moodAccent(moodKey: string | null): AccentColor {
  if (!moodKey) return "gold";
  return (moodMap[moodKey]?.accentColor ?? "gold") as AccentColor;
}

function moodLabel(moodKey: string | null): string {
  if (!moodKey) return "—";
  return moodKey.charAt(0).toUpperCase() + moodKey.slice(1);
}

export default function ProfileHero({ user }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/stats", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load stats");
        const data: Stats = await res.json();
        if (!cancelled) setStats(data);
      } catch {
        if (!cancelled)
          setStats({
            watchlistCount: 0,
            moodPicks: 0,
            topMood: null,
            sessionsJoined: 0,
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const initial = user.email?.[0]?.toUpperCase() ?? "U";
  const displayName =
    user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "User";
  const joinedDate = new Date(user.created_at).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const topMoodKey = stats?.topMood ?? null;
  const topMoodAccent = moodAccent(topMoodKey);

  return (
    <section
      className="relative mb-7 overflow-hidden rounded-[18px] border px-7 pb-6 pt-7 md:px-9 md:pb-7 md:pt-8"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      {/* Subtle radial wash tinted to the user's top-mood accent. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 80% at 12% 0%, rgba(var(--${topMoodAccent}-rgb), 0.16), transparent 60%), radial-gradient(40% 60% at 100% 100%, rgba(var(--violet-rgb), 0.10), transparent 60%)`,
        }}
      />

      <div className="relative grid grid-cols-[auto_1fr] items-center gap-5 md:gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div
            className="font-serif flex items-center justify-center rounded-full leading-none transition-shadow"
            style={{
              width: "72px",
              height: "72px",
              background: "var(--gold)",
              color: "var(--accent-ink)",
              fontSize: "26px",
              fontWeight: 700,
              boxShadow:
                "0 0 0 1px var(--border), 0 8px 28px rgba(var(--gold-rgb), 0.30)",
            }}
          >
            {initial}
          </div>
          <button
            type="button"
            aria-label="Edit avatar"
            className="absolute bottom-0 right-0 flex items-center justify-center rounded-full border transition-colors"
            style={{
              width: "26px",
              height: "26px",
              background: "var(--surface2)",
              borderColor: "var(--border)",
              color: "var(--t2)",
            }}
          >
            <Icon name="pencil" size={12} />
          </button>
        </div>

        {/* Name + email + meta */}
        <div className="min-w-0">
          <p
            className="font-serif"
            style={{
              fontSize: "clamp(22px, 4vw, 28px)",
              fontWeight: 600,
              color: "var(--t1)",
              lineHeight: 1.1,
              letterSpacing: "-0.4px",
              margin: "0 0 4px",
            }}
          >
            {displayName}
          </p>
          <p
            style={{
              fontSize: "13px",
              color: "var(--t2)",
              margin: "0 0 14px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {user.email}
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-baseline gap-2">
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Member since
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: "var(--t2)",
                }}
              >
                {joinedDate}
              </span>
            </span>

            <span
              aria-hidden
              style={{
                width: "1px",
                height: "14px",
                background: "var(--border-h)",
              }}
              className="hidden md:block"
            />

            <span className="inline-flex items-center gap-2">
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: "var(--t3)",
                }}
              >
                Top mood
              </span>
              <span
                className="inline-flex items-center gap-1.5"
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  textTransform: "uppercase",
                  color: ACCENT_VARS[topMoodAccent].base,
                }}
              >
                <Icon name="mark" size={11} />
                {moodLabel(topMoodKey)}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Stats strip */}
      <div
        className="relative mt-6 grid grid-cols-2 sm:grid-cols-4 overflow-hidden rounded-xl border"
        style={{
          gap: "1px",
          background: "var(--border)",
          borderColor: "var(--border)",
        }}
      >
        <Stat
          value={stats == null ? "·" : String(stats.watchlistCount)}
          label="Watchlist"
          color="var(--gold)"
        />
        <Stat
          value={stats == null ? "·" : String(stats.moodPicks)}
          label="Mood picks"
          color="var(--blue)"
        />
        <Stat
          value={moodLabel(topMoodKey)}
          label="Top mood"
          color={ACCENT_VARS[topMoodAccent].base}
          italic
        />
        <Stat
          value={stats == null ? "·" : String(stats.sessionsJoined).padStart(2, "0")}
          label="Sessions"
          color="var(--teal)"
        />
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  color,
  italic,
}: {
  value: string;
  label: string;
  color: string;
  italic?: boolean;
}) {
  return (
    <div
      className="px-3 py-3.5 text-center"
      style={{ background: "var(--surface2)" }}
    >
      <div
        className="font-serif"
        style={{
          fontWeight: 600,
          fontStyle: italic ? "italic" : "normal",
          color,
          fontSize: italic ? "clamp(13px, 3vw, 16px)" : "clamp(15px, 4vw, 22px)",
          lineHeight: 1,
          marginBottom: "6px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "9.5px",
          fontWeight: 700,
          letterSpacing: "1.4px",
          textTransform: "uppercase",
          color: "var(--t3)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
