"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import { tmdbImageUrl } from "@/lib/tmdb";

interface SessionParticipant {
  nickname: string;
  user_id: string | null;
}

interface RecentSession {
  id: string;
  code: string;
  status: string;
  created_at: string;
  participantCount: number;
  participants: SessionParticipant[];
  topPickTitle: string | null;
  topPickPoster: string | null;
}

const PARTICIPANT_COLORS = [
  "var(--gold)",
  "var(--blue)",
  "var(--teal)",
  "var(--rose)",
  "var(--violet)",
  "var(--ember)",
];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d} days ago`;
  if (d < 30) return `${Math.floor(d / 7)} weeks ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    year: "numeric",
  });
}

function statusLabel(status: string): { text: string; tone: "match" | "neutral" | "live" } {
  switch (status) {
    case "done":
      return { text: "Match resolved", tone: "match" };
    case "swiping":
      return { text: "Swiping", tone: "live" };
    case "mood":
      return { text: "Picking moods", tone: "live" };
    case "lobby":
      return { text: "In lobby", tone: "live" };
    default:
      return { text: status, tone: "neutral" };
  }
}

export default function RecentGroupSessions() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<RecentSession[] | null>(null);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/profile/recent-sessions", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load sessions");
        const data = await res.json();
        if (!cancelled) setSessions((data.sessions ?? []) as RecentSession[]);
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const isLoading = sessions === null;
  const list = sessions ?? [];

  return (
    <div
      className="mb-4 rounded-2xl border p-5.5"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="mb-4 text-[10px] font-semibold uppercase tracking-[1.8px]"
        style={{ color: "var(--t3)" }}
      >
        Recent group sessions
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="search-skeleton-bar"
              style={{ height: "78px", borderRadius: "12px" }}
            />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="py-6 text-center">
          <p style={{ fontSize: "13px", color: "var(--t2)", margin: "0 0 4px" }}>
            No sessions yet
          </p>
          <p style={{ fontSize: "11px", color: "var(--t3)", margin: 0 }}>
            Start one with friends — it&apos;ll show up here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {list.map((session) => {
            const status = statusLabel(session.status);
            const posterUrl = tmdbImageUrl(session.topPickPoster, "w185");
            const targetHref =
              session.status === "done"
                ? `/group/${session.code}/results`
                : `/group/${session.code}`;
            return (
              <Link
                key={session.id}
                href={targetHref}
                className="flex items-start gap-3 rounded-xl p-3 no-underline transition-colors"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--surface2)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border-h)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border-h)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
              >
                {/* Poster slot — falls back to a code-tagged placeholder */}
                {posterUrl ? (
                  <div
                    role="img"
                    aria-label={session.topPickTitle ?? `Session ${session.code}`}
                    className="shrink-0 rounded-[7px] bg-cover bg-center"
                    style={{
                      width: "42px",
                      height: "60px",
                      background: `var(--surface3) url('${posterUrl}') center/cover`,
                    }}
                  />
                ) : (
                  <div
                    className="font-serif flex shrink-0 items-center justify-center rounded-[7px]"
                    style={{
                      width: "42px",
                      height: "60px",
                      background: "var(--surface3)",
                      color: "var(--t3)",
                      fontSize: "10px",
                      fontWeight: 700,
                      letterSpacing: "1.2px",
                    }}
                  >
                    {session.code.slice(0, 4)}
                  </div>
                )}

                <div className="min-w-0 flex-1 flex flex-col gap-1.5">
                  <div
                    className="truncate"
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "var(--t1)",
                      lineHeight: 1.2,
                    }}
                  >
                    {session.topPickTitle ?? `Session ${session.code}`}
                  </div>

                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--t3)",
                      lineHeight: 1,
                    }}
                  >
                    {relativeTime(session.created_at)} · {session.participantCount} participants
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center">
                      {session.participants.slice(0, 5).map((p, i) => (
                        <div
                          key={`${p.nickname}-${i}`}
                          className="font-serif flex items-center justify-center rounded-full"
                          style={{
                            width: "20px",
                            height: "20px",
                            fontSize: "9px",
                            fontWeight: 700,
                            color: "var(--accent-ink)",
                            background:
                              PARTICIPANT_COLORS[
                                i % PARTICIPANT_COLORS.length
                              ],
                            marginLeft: i === 0 ? 0 : "-4px",
                            border: "2px solid var(--surface2)",
                          }}
                          title={p.nickname}
                        >
                          {p.nickname.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {session.participants.length > 5 && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "10px",
                            color: "var(--t3)",
                          }}
                        >
                          +{session.participants.length - 5}
                        </span>
                      )}
                    </div>

                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "10px",
                        fontWeight: 700,
                        letterSpacing: "0.4px",
                        whiteSpace: "nowrap",
                        background:
                          status.tone === "match"
                            ? "var(--teal-soft)"
                            : status.tone === "live"
                              ? "var(--gold-soft)"
                              : "var(--tag-bg)",
                        color:
                          status.tone === "match"
                            ? "var(--teal)"
                            : status.tone === "live"
                              ? "var(--gold)"
                              : "var(--t2)",
                      }}
                    >
                      {status.text}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
