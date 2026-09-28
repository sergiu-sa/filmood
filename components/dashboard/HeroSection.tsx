"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { getHeroMode } from "@/lib/heroMode";
import { allMoods } from "@/lib/moodMap";
import FilmoodLogo from "./FilmoodLogo";
import HeroDateline from "./HeroDateline";
import HeroCornerMarks from "./HeroCornerMarks";
import HeroFeatureFilm from "./HeroFeatureFilm";
import HeroNowShowing from "./HeroNowShowing";
import HeroPersonalized from "./HeroPersonalized";

/** Cycling mood reel — uses real mood keys from moodMap so clicks wire up cleanly. */
const MOOD_REEL: { key: string; word: string }[] = [
  { key: "laugh",       word: "Laugh" },
  { key: "escape",      word: "Transported" },
  { key: "thrilling",   word: "Thrilling" },
  { key: "cry",         word: "Melancholy" },
  { key: "mindbending", word: "Curious" },
  { key: "easy",        word: "Cozy" },
  { key: "inspiring",   word: "Inspired" },
  { key: "unsettled",   word: "Unsettled" },
];

interface HeroSectionProps {
  /** Fired when user clicks the cycling mood word — parent pre-selects that mood + scrolls. */
  onPreselectMood?: (key: string) => void;
}

interface GroupSession { code: string; waiting: number; status: string }
interface WatchlistItem { movie_id: number; title: string; poster_path: string | null }

export default function HeroSection({ onPreselectMood }: HeroSectionProps) {
  const isMobile = useMediaQuery("(max-width: 820px)");
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { user, loading: authLoading } = useAuth();

  // Cycling mood
  const [moodIndex, setMoodIndex] = useState(0);
  const [fading, setFading] = useState(false);

  // Personalization data
  const [lastMood, setLastMood] = useState<string | null>(null);
  const [group, setGroup] = useState<GroupSession | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);

  // Cycle the mood reel every 3s
  useEffect(() => {
    if (prefersReducedMotion) return;
    let t: ReturnType<typeof setTimeout>;
    const id = setInterval(() => {
      setFading(true);
      t = setTimeout(() => {
        setMoodIndex((i) => (i + 1) % MOOD_REEL.length);
        setFading(false);
      }, 500);
    }, 3000);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, [prefersReducedMotion]);

  // Fetch personalization data once user is loaded
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const [historyRes, groupRes, watchRes] = await Promise.all([
          fetch("/api/mood-history", { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/group/mine", { headers }).then((r) => (r.ok ? r.json() : null)),
          fetch("/api/watchlist?limit=3", { headers }).then((r) => (r.ok ? r.json() : null)),
        ]);
        if (cancelled) return;
        setLastMood(historyRes?.top?.[0]?.mood ?? null);
        setGroup(groupRes?.session ?? null);
        setWatchlist(watchRes?.watchlist ?? []);
      } catch {
        /* silent; fall back to guest content */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const current = MOOD_REEL[moodIndex];
  const currentMoodCfg = allMoods.find((m) => m.key === current.key);
  const cyclerAccent = currentMoodCfg ? `var(--${currentMoodCfg.accentColor})` : "var(--gold)";
  const cyclerAccentRgb = currentMoodCfg ? `var(--${currentMoodCfg.accentColor}-rgb)` : "var(--gold-rgb)";
  const lastMoodCfg = lastMood ? allMoods.find((m) => m.key === lastMood) : null;

  const mode = getHeroMode({
    isAuthed: !!user,
    hasHistory: !!lastMood,
    hasWatchlist: watchlist.length > 0,
    hasActiveGroup: !!group,
  });

  const handleCyclerClick = useCallback(() => {
    onPreselectMood?.(current.key);
  }, [onPreselectMood, current.key]);

  const handleContinueClick = useCallback(() => {
    if (lastMood) onPreselectMood?.(lastMood);
  }, [onPreselectMood, lastMood]);

  // Pick the accent for this render — gold normally, teal in authed-full mode
  const accentVar = mode !== "guest" ? "--teal" : "--gold";
  const accent = `var(${accentVar})`;

  return (
    <section
      aria-label="Filmood — Play Your Mood"
      style={{
        position: "relative", width: "100%",
        minHeight: isMobile ? "auto" : "360px",
        padding: isMobile ? "28px 22px 24px" : "36px 44px 30px",
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.9fr",
        gap: isMobile ? "28px" : "40px",
        alignItems: "center",
      }}
    >
      {/* Ambient orbs (existing) */}
      <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, overflow: "hidden" }}>
        <div
          className="hero-orb"
          style={{
            position: "absolute", top: "-12%", left: "15%",
            width: 380, height: 240, borderRadius: "50%",
            background: `radial-gradient(ellipse, rgba(var(${accentVar}-rgb), 0.5), transparent 70%)`,
            filter: "blur(50px)", opacity: 0.7,
            animation: prefersReducedMotion ? "none" : "heroOrbDrift1 16s ease-in-out infinite",
          }}
        />
        <div
          className="hero-orb"
          style={{
            position: "absolute", bottom: "-15%", right: "10%",
            width: 260, height: 180, borderRadius: "50%",
            background: "radial-gradient(ellipse, rgba(var(--rose-rgb), 0.35), transparent 65%)",
            filter: "blur(50px)", opacity: 0.5,
            animation: prefersReducedMotion ? "none" : "heroOrbDrift2 20s ease-in-out infinite",
          }}
        />
        <div className="hero-grain" />
      </div>

      {!isMobile && <HeroCornerMarks accentVar={accentVar} />}
      <div
        style={{
          position: "absolute",
          top: 28,
          right: isMobile ? "auto" : 32,
          left: isMobile ? 22 : "auto",
          zIndex: 2,
        }}
      >
        <HeroDateline name={user?.email?.split("@")[0] ?? null} />
      </div>

      {/* ─── Left column ─── */}
      <div style={{ position: "relative", zIndex: 2 }}>
        <div style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: 2.4,
          textTransform: "uppercase",
          color: accent,
          marginBottom: 14,
        }}>
          Moods, not genres
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <FilmoodLogo variant="hero" size={28} />
          <span style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontWeight: 600, fontSize: 17, color: "var(--t1)", letterSpacing: -0.2,
          }}>Filmood</span>
        </div>

        <h1
          className="font-serif"
          style={{
            fontFamily: "var(--font-serif), Georgia, serif", fontWeight: 400,
            fontSize: isMobile ? 38 : 52,
            lineHeight: 1.02, letterSpacing: -1, color: "var(--t1)",
            marginBottom: 18,
          }}
        >
          {mode === "authed-full" || mode === "authed-history-only" ? (
            <>
              Still in the mood to{" "}
              <button
                type="button"
                onClick={handleContinueClick}
                aria-label={`Continue with mood ${lastMoodCfg?.tagLabel ?? "your last pick"}`}
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit",
                  fontStyle: "italic",
                  color: "var(--teal)",
                  borderBottom: "1.5px dashed rgba(var(--teal-rgb), 0.45)",
                  padding: "0 3px",
                }}
              >
                {lastMoodCfg?.label.split(/[ ,.]/)[0].toLowerCase() ?? "continue"}?
              </button>
            </>
          ) : (
            <>
              Play Your{" "}
              <button
                type="button"
                onClick={handleCyclerClick}
                aria-label={`Start with mood ${current.word}`}
                aria-live="polite"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  fontFamily: "inherit", fontSize: "inherit", fontWeight: "inherit",
                  fontStyle: "italic",
                  color: cyclerAccent,
                  borderBottom: `1.5px dashed rgba(${cyclerAccentRgb}, 0.45)`,
                  padding: "0 3px",
                  opacity: fading ? 0 : 1,
                  transform: fading ? "translateY(6px)" : "translateY(0)",
                  transition: "opacity 0.4s, transform 0.4s, color 0.8s",
                }}
              >
                {current.word}.
              </button>
            </>
          )}
        </h1>

        <p style={{
          fontSize: 14.5, color: "var(--t2)", lineHeight: 1.5,
          maxWidth: 360, marginBottom: 22, fontWeight: 300,
        }}>
          {mode === "authed-full" && (
            `Last pick: ${lastMoodCfg?.tagLabel ?? "recent"}. ${watchlist.length} on your watchlist${group ? `, ${group.waiting} waiting in ${group.code}` : ""}.`
          )}
          {mode === "authed-history-only" && (
            `Last pick: ${lastMoodCfg?.tagLabel ?? "recent"}. Or pick fresh below.`
          )}
          {mode === "authed-watchlist-only" && (
            `${watchlist.length} on your watchlist — tell Filmood what you're in the mood for.`
          )}
          {mode === "guest" && "Tell Filmood how you want to feel. Solo or as a group."}
        </p>

        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
          {mode === "authed-full" || mode === "authed-history-only" ? (
            <>
              <button
                type="button"
                onClick={handleContinueClick}
                style={{
                  background: "var(--gold)", color: "var(--accent-ink)",
                  border: "none", padding: "8px 14px", borderRadius: 999,
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                Continue →
              </button>
              <button
                type="button"
                onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
                style={{
                  background: "transparent", color: "var(--t2)",
                  border: "1px solid var(--border)",
                  padding: "8px 14px", borderRadius: 999,
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                Pick fresh
              </button>
            </>
          ) : (
            <>
              {["laugh", "escape", "unsettled"].map((key) => {
                const mood = allMoods.find((m) => m.key === key)!;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onPreselectMood?.(key)}
                    style={{
                      background: `rgba(var(--${mood.accentColor}-rgb), 0.1)`,
                      color: `var(--${mood.accentColor})`,
                      border: `1px solid rgba(var(--${mood.accentColor}-rgb), 0.28)`,
                      padding: "6px 12px", borderRadius: 999,
                      fontSize: 11.5, fontWeight: 500, cursor: "pointer",
                    }}
                  >
                    {mood.label.split(/[ ,.]/)[0]}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => document.getElementById("dashboard")?.scrollIntoView({ behavior: "smooth" })}
                style={{
                  background: "transparent", color: "var(--gold)",
                  border: "none", padding: "6px 4px",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}
              >
                + 12 more →
              </button>
            </>
          )}
        </div>
      </div>

      {/* ─── Right column — switches on hero mode ─── */}
      <div
        style={{
          position: "relative", zIndex: 2,
          display: "flex", justifyContent: isMobile ? "center" : "flex-start",
          flexDirection: "column", alignItems: isMobile ? "center" : "flex-start",
        }}
      >
        {mode === "authed-full" ? (
          <HeroPersonalized groupSession={group} watchlistPeek={watchlist} />
        ) : mode === "authed-watchlist-only" ? (
          <HeroPersonalized groupSession={null} watchlistPeek={watchlist} />
        ) : (
          <div style={{
            display: "flex",
            flexDirection: "row",
            gap: 30,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}>
            <HeroFeatureFilm moodKey={current.key} />
            <HeroNowShowing />
          </div>
        )}
      </div>
    </section>
  );
}
