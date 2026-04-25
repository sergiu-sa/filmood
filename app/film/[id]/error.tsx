"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary for /film/[id]. The detail page is fragile-by-design (it
// depends on TMDB + Supabase + ISR), so render a graceful surface rather
// than an uncaught crash.
export default function FilmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("film detail error", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          maxWidth: "440px",
          textAlign: "center",
        }}
      >
        <p
          className="font-serif"
          style={{
            fontSize: "22px",
            fontWeight: 600,
            color: "var(--t1)",
            margin: "0 0 12px",
            letterSpacing: "-0.3px",
          }}
        >
          Something broke loading this film.
        </p>
        <p
          style={{
            fontSize: "14px",
            color: "var(--t2)",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          We couldn&apos;t reach TMDB or one of its sub-endpoints. Try again
          in a moment, or head back to browse.
        </p>
        <div
          style={{
            display: "flex",
            gap: "10px",
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <button
            onClick={() => reset()}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              background: "var(--gold)",
              color: "var(--accent-ink)",
              border: 0,
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          <Link
            href="/browse"
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              background: "var(--tag-bg)",
              color: "var(--t1)",
              border: "1px solid var(--tag-border)",
              fontSize: "13px",
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            Browse films
          </Link>
        </div>
      </div>
    </main>
  );
}
