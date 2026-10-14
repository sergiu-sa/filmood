"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SESSION_EXPIRY_HOURS } from "@/lib/constants";

export type EndReason = "expired" | "removed";

const COPY: Record<EndReason, { title: string; line: string }> = {
  expired: { title: "This session has expired", line: `Group sessions last ${SESSION_EXPIRY_HOURS} hours.` },
  removed: { title: "You're no longer in this session", line: "The host carried on without you." },
};

/** Replaces the mood or swipe page once nothing on it can work: every lock-in or vote would fail. */
export default function SessionEnded({ reason }: { reason: EndReason }) {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { title, line } = COPY[reason];

  // The tiles or the card that had focus are gone.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main
      className="lobby-grain min-h-screen font-sans"
      style={{ background: "var(--bg)", color: "var(--t1)" }}
    >
      <div className="lobby-ambient" />
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ minHeight: "60vh", padding: "0 20px", textAlign: "center", position: "relative", zIndex: 2 }}
      >
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="font-serif"
          style={{ margin: 0, fontSize: "24px", fontWeight: 600, color: "var(--t1)", outline: "none" }}
        >
          {title}
        </h1>
        <p style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--t2)" }}>{line}</p>
        <button
          onClick={() => router.push("/group")}
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
          Back to group
        </button>
      </div>
    </main>
  );
}
