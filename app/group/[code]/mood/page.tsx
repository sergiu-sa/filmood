"use client";

import { useEffect, useId, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useParticipantId } from "@/lib/useParticipantId";
import { useGroupRealtime } from "@/lib/useGroupRealtime";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { allMoods, MAX_MOODS } from "@/lib/moodMap";
import { LONG_OPTIONS, SHORT_OPTIONS } from "@/lib/moodFilters";
import { MAX_TEXT_LENGTH, resolveMoodText } from "@/lib/moodResolver";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { EraKey, TimeKey } from "@/lib/types";
import Breadcrumb from "@/components/Breadcrumb";
import FilterGroup from "@/components/mood/FilterGroup";
import MoodEcho from "@/components/mood/MoodEcho";
import MoodGrid from "@/components/mood/MoodGrid";
import MoodTile from "@/components/mood/MoodTile";
import Icon from "@/components/ui/Icon";

type Phase = "selecting" | "submitting" | "waiting" | "building";

const MAX_HINT = "Two is the max — tap one of yours to swap it out.";

interface SessionInfo {
  id: string;
  status: string;
}

interface ParticipantProgress {
  id: string;
  nickname: string;
  hasSubmitted: boolean;
}

export default function GroupMoodPage() {
  const params = useParams<{ code: string }>();
  const code = params.code;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [phase, setPhase] = useState<Phase>("selecting");
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  /** Tile moods in tap order, which is the order the route stores them in. */
  const [picked, setPicked] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [participants, setParticipants] = useState<ParticipantProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [era, setEra] = useState<EraKey | null>(null);
  const [time, setTime] = useState<TimeKey | null>(null);
  const [moodText, setMoodText] = useState("");
  const narrow = useMediaQuery("(max-width: 899px)");
  const describeId = useId();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const { participantId } = useParticipantId();
  const redirectingRef = useRef(false);
  const buildingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (buildingTimerRef.current) clearTimeout(buildingTimerRef.current);
    };
  }, []);

  const fetchState = useCallback(async () => {
    if (redirectingRef.current) return;

    try {
      const res = await fetch(`/api/group/${code}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load session");
        return;
      }

      setSessionInfo({ id: data.session.id, status: data.session.status });

      // Handle status transitions
      if (data.session.status === "swiping") {
        setPhase("building");
        redirectingRef.current = true;
        buildingTimerRef.current = setTimeout(() => {
          router.replace(`/group/${code}/swipe`);
        }, 1500);
        return;
      }
      if (data.session.status === "done") {
        redirectingRef.current = true;
        router.replace(`/group/${code}/results`);
        return;
      }
      if (data.session.status === "lobby") {
        redirectingRef.current = true;
        router.replace(`/group/${code}`);
        return;
      }

      // Map participants to progress
      const progress: ParticipantProgress[] = data.participants.map(
        (p: { id: string; nickname: string; has_submitted: boolean }) => ({
          id: p.id,
          nickname: p.nickname,
          hasSubmitted: p.has_submitted,
        }),
      );
      setParticipants(progress);

      // Check if current user already submitted
      const self = data.participants.find(
        (p: { user_id: string | null; id: string; has_submitted: boolean }) => {
          if (user) return p.user_id === user.id;
          return p.id === participantId;
        },
      );

      if (self?.has_submitted) {
        setPhase((prev) => prev === "building" ? prev : "waiting");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [code, router, user, participantId]);

  // Initial fetch
  useEffect(() => {
    if (!authLoading) {
      fetchState();
    }
  }, [authLoading, fetchState]);

  // Store sessionId
  useEffect(() => {
    if (sessionInfo && !sessionId) {
      setSessionId(sessionInfo.id);
    }
  }, [sessionInfo, sessionId]);

  // Realtime + polling
  useGroupRealtime({
    sessionId,
    channelPrefix: "mood",
    onUpdate: fetchState,
    paused: loading || phase === "building",
  });

  const toggleMood = (key: string) => {
    if (phase !== "selecting") return;
    if (picked.includes(key)) {
      setPicked(picked.filter((k) => k !== key));
      setHint("");
    } else if (picked.length < MAX_MOODS) {
      setPicked([...picked, key]);
      setHint("");
    } else {
      setHint(MAX_HINT);
    }
  };

  const trimmedText = moodText.trim();
  // What the route will store: tiles first, then the text's moods, two in all.
  const lockedCount = Math.min(
    MAX_MOODS,
    new Set([...picked, ...(trimmedText ? resolveMoodText(trimmedText).moodKeys : [])]).size,
  );
  const canSubmit = lockedCount > 0;

  const handleSubmit = async () => {
    if (!canSubmit || phase !== "selecting") return;
    setPhase("submitting");
    setError(null);

    try {
      const headers = await getAuthHeaders();
      const isGuest = !headers.Authorization;

      const body: {
        moods: string[];
        time: TimeKey | null;
        era: EraKey | null;
        participantId?: string;
        text?: string;
      } = { moods: picked, time, era };
      if (isGuest && participantId) {
        body.participantId = participantId;
      }
      if (trimmedText) body.text = trimmedText;

      const res = await fetch(`/api/group/${code}/mood`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to submit moods");
        setPhase("selecting");
        return;
      }

      if (data.allDone) {
        setPhase("building");
        redirectingRef.current = true;
        buildingTimerRef.current = setTimeout(() => {
          router.replace(`/group/${code}/swipe`);
        }, 1500);
      } else {
        setPhase("waiting");
      }
    } catch {
      setError("Something went wrong");
      setPhase("selecting");
    }
  };

  const submittedCount = participants.filter((p) => p.hasSubmitted).length;
  const totalCount = participants.length;

  // Loading state
  if (loading || authLoading) {
    return (
      <main
        className="lobby-grain min-h-screen font-sans"
        style={{ background: "var(--bg)", color: "var(--t1)" }}
      >
        <div className="lobby-ambient" />
        <div
          className="flex flex-col items-center justify-center gap-3"
          style={{ minHeight: "60vh", position: "relative", zIndex: 2 }}
        >
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--violet)",
              animation: "breathe 2s ease-in-out infinite",
            }}
          />
          <p
            className="font-sans"
            style={{ fontSize: "13px", color: "var(--t3)", fontWeight: 500 }}
          >
            Entering mood room...
          </p>
        </div>
      </main>
    );
  }

  // Error state
  if (error && !sessionInfo) {
    return (
      <main
        className="lobby-grain min-h-screen font-sans"
        style={{ background: "var(--bg)", color: "var(--t1)" }}
      >
        <div className="lobby-ambient" />
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ minHeight: "60vh", position: "relative", zIndex: 2 }}
        >
          <p style={{ fontSize: "14px", color: "var(--rose)" }}>{error}</p>
          <button
            onClick={() => router.push(`/group/${code}`)}
            className="cursor-pointer font-sans"
            style={{
              padding: "10px 24px",
              borderRadius: "var(--r)",
              background: "none",
              color: "var(--t2)",
              fontSize: "13px",
              fontWeight: 500,
              border: "1px solid var(--border)",
            }}
          >
            Back to lobby
          </button>
        </div>
      </main>
    );
  }

  // "Building deck" transition
  if (phase === "building") {
    return (
      <main
        className="lobby-grain min-h-screen font-sans"
        style={{ background: "var(--bg)", color: "var(--t1)" }}
      >
        <div className="lobby-ambient" />
        <div
          className="flex flex-col items-center justify-center gap-4"
          style={{ minHeight: "60vh", position: "relative", zIndex: 2 }}
        >
          <div style={{ position: "relative", width: "48px", height: "48px" }}>
            <div
              style={{
                position: "absolute",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--violet)",
                top: "0",
                left: "20px",
                animation: "breathe 1.2s ease-in-out infinite",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--teal)",
                bottom: "4px",
                left: "4px",
                animation: "breathe 1.2s ease-in-out infinite 0.3s",
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "var(--gold)",
                bottom: "4px",
                right: "4px",
                animation: "breathe 1.2s ease-in-out infinite 0.6s",
              }}
            />
          </div>
          <p
            className="font-serif"
            style={{
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--t1)",
              letterSpacing: "-0.2px",
            }}
          >
            Building your deck
          </p>
          <p
            className="font-sans"
            style={{ fontSize: "13px", color: "var(--t3)" }}
          >
            Merging moods into films...
          </p>
        </div>
      </main>
    );
  }

  const selecting = phase === "selecting" || phase === "submitting";
  const lockLabel =
    phase === "submitting"
      ? "Submitting..."
      : canSubmit
        ? `Lock in ${lockedCount} mood${lockedCount > 1 ? "s" : ""}`
        : "Pick a mood to lock in";
  // The label sits above the segments, as in the vertical rows; FilterGroup's own sits beside them.
  const filterGroup = (label: string, control: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: narrow ? "stretch" : "flex-start", gap: "10px" }}>
      <span
        aria-hidden="true"
        style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "1.4px", textTransform: "uppercase", color: "var(--t2)" }}
      >
        {label}
      </span>
      {control}
    </div>
  );

  return (
    <main
      className="lobby-grain min-h-screen font-sans"
      style={{
        background: "var(--bg)",
        color: "var(--t1)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="lobby-ambient" />

      <div
        className="mx-auto"
        style={{
          maxWidth: "1080px",
          padding: narrow ? "32px 16px 48px" : "44px 24px 60px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <Breadcrumb
            items={[
              { label: "Home", href: "/" },
              { label: "Group", href: "/group" },
              { label: "Mood Selection" },
            ]}
          />
        </div>

        <div
          className="lobby-section-1"
          style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", marginBottom: "26px" }}
        >
          <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--t2)" }}>
            Session <span style={{ color: "var(--t1)", fontWeight: 700, letterSpacing: "1px" }}>{code}</span>
            {" · "}
            {totalCount} {totalCount === 1 ? "person" : "people"}
          </p>
          <h1
            className="font-serif"
            style={{ margin: "0 0 8px", fontSize: "clamp(28px, 4vw, 40px)", fontWeight: 600, letterSpacing: "-0.3px" }}
          >
            {phase === "waiting" ? "Moods submitted" : "How do you feel?"}
          </h1>
          <p style={{ margin: "0 0 14px", fontSize: "14.5px", lineHeight: 1.5, color: "var(--t2)" }}>
            {phase === "waiting"
              ? "Waiting for everyone to choose"
              : "Your picks are private \u2014 no one else can see them."}
          </p>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "var(--violet-soft)",
              border: "1px solid var(--violet-border)",
              color: "var(--violet)",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            <Icon name="lock" size={13} />
            Private selection
          </span>
        </div>

        <section
          className="lobby-section-2"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "22px",
            padding: narrow ? "22px 18px" : "28px 30px",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "20px",
          }}
        >
          {/* inert, not just pointer-events: a keyboard could otherwise still toggle tiles while submitting. */}
          <div
            inert={phase !== "selecting"}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "22px",
              transition: "opacity 0.4s ease",
              opacity: phase === "selecting" ? 1 : 0.4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <h2 className="font-serif" style={{ margin: 0, fontSize: "22px", fontWeight: 600 }}>
                Pick up to two moods
              </h2>
              <span
                style={{
                  flexShrink: 0,
                  padding: "6px 12px",
                  borderRadius: "999px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border-h)",
                  fontSize: "12.5px",
                  fontWeight: 700,
                }}
              >
                {picked.length} of {MAX_MOODS}
              </span>
            </div>

            <div>
              <MoodGrid>
                {allMoods.map((m) => (
                  <MoodTile key={m.key} moodKey={m.key} pressed={picked.includes(m.key)} onToggle={toggleMood} />
                ))}
              </MoodGrid>
              <p aria-live="polite" style={{ margin: "14px 0 0", minHeight: "20px", fontSize: "13px", color: "var(--t2)" }}>
                {hint}
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: narrow ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
                gap: "20px",
                paddingTop: "20px",
                borderTop: "1px solid var(--border)",
              }}
            >
              {filterGroup(
                "Time",
                <FilterGroup
                  label="Time"
                  hideLabel
                  orientation={narrow ? "vertical" : "horizontal"}
                  options={narrow ? LONG_OPTIONS.time : SHORT_OPTIONS.time}
                  value={time}
                  onChange={setTime}
                />,
              )}
              {filterGroup(
                "Era",
                <FilterGroup
                  label="Era"
                  hideLabel
                  orientation={narrow ? "vertical" : "horizontal"}
                  options={narrow ? LONG_OPTIONS.era : SHORT_OPTIONS.era}
                  value={era}
                  onChange={setEra}
                />,
              )}
            </div>

            <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--t2)" }}>
              <strong style={{ color: "var(--t1)", fontWeight: 600 }}>Where:</strong> we&apos;ll search across
              everyone&apos;s saved streaming services — or all Norway streaming if nobody has saved any, or nothing on
              them fits.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label htmlFor={describeId} style={{ fontSize: "12px", fontWeight: 600, color: "var(--t2)" }}>
                Anything else? (optional)
              </label>
              <input
                id={describeId}
                className="mood-describe-input"
                value={moodText}
                onChange={(e) => setMoodText(e.target.value)}
                maxLength={MAX_TEXT_LENGTH}
                placeholder="e.g. something with a heist"
                style={{
                  boxSizing: "border-box",
                  height: "48px",
                  padding: "0 14px",
                  background: "var(--surface2)",
                  border: "1px solid var(--border-h)",
                  borderRadius: "12px",
                  font: "inherit",
                  fontSize: "15px",
                  color: "var(--t1)",
                }}
              />
              <MoodEcho text={trimmedText} picked={picked} time={time} era={era} />
            </div>
          </div>

          <div style={{ paddingTop: "20px", borderTop: "1px solid var(--border)" }}>
            {selecting ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                {error && (
                  <p role="alert" style={{ margin: 0, fontSize: "13px", color: "var(--t1)" }}>
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleSubmit}
                  aria-disabled={!canSubmit || phase === "submitting"}
                  style={{
                    height: "50px",
                    minWidth: "260px",
                    padding: "0 26px",
                    border: "none",
                    borderRadius: "12px",
                    background: canSubmit ? "var(--gold)" : "var(--surface2)",
                    color: canSubmit ? "var(--accent-ink)" : "var(--t2)",
                    font: "inherit",
                    fontSize: "15px",
                    fontWeight: 700,
                    cursor: canSubmit && phase === "selecting" ? "pointer" : "not-allowed",
                    opacity: phase === "submitting" ? 0.7 : 1,
                  }}
                >
                  {lockLabel}
                </button>
                <span style={{ fontSize: "12.5px", color: "var(--t2)" }}>
                  Once submitted, you can&apos;t change your picks.
                </span>
              </div>
            ) : (
              // Waiting state — progress view
              <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-3">
                  <div style={{ position: "relative", width: "44px", height: "44px" }}>
                    <svg
                      width="44"
                      height="44"
                      viewBox="0 0 44 44"
                      style={{ transform: "rotate(-90deg)" }}
                    >
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="var(--surface2)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="var(--violet)"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${totalCount > 0 ? (submittedCount / totalCount) * 113 : 0} 113`}
                        style={{ transition: "stroke-dasharray 0.5s ease" }}
                      />
                    </svg>
                    <span
                      className="font-sans"
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "var(--violet)",
                      }}
                    >
                      {submittedCount}/{totalCount}
                    </span>
                  </div>

                  <div>
                    <p
                      className="font-sans"
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--t1)",
                        marginBottom: "2px",
                      }}
                    >
                      {submittedCount === totalCount ? "Everyone is in" : "Waiting for moods"}
                    </p>
                    <p
                      className="font-sans"
                      style={{ fontSize: "12px", color: "var(--t3)" }}
                    >
                      {totalCount - submittedCount} still choosing
                    </p>
                  </div>
                </div>

                <div
                  className="w-full flex flex-col gap-2"
                  style={{ maxWidth: "280px" }}
                >
                  {participants.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between font-sans"
                      style={{
                        padding: "8px 12px",
                        borderRadius: "8px",
                        background: p.hasSubmitted ? "var(--violet-soft)" : "var(--surface2)",
                        border: `1px solid ${p.hasSubmitted ? "rgba(var(--violet-rgb), 0.15)" : "var(--border)"}`,
                        transition: "all 0.3s ease",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: p.hasSubmitted ? "var(--t1)" : "var(--t3)",
                        }}
                      >
                        {p.nickname}
                      </span>
                      {p.hasSubmitted ? (
                        <span
                          style={{
                            fontSize: "11px",
                            fontWeight: 600,
                            color: "var(--violet)",
                          }}
                        >
                          Locked in
                        </span>
                      ) : (
                        <span
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: "var(--t3)",
                            animation: "breathe 2s ease-in-out infinite",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
