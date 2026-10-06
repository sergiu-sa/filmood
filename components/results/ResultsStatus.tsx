"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { EditForm, withText } from "@/components/results/MoodHeader";

const column = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "60vh",
  textAlign: "center",
} as const;

export function ResultsLoading({ label = "Finding films for your mood..." }: { label?: string }) {
  return (
    <div style={{ ...column, gap: "12px" }}>
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "var(--gold)",
          animation: "breathe 2s ease-in-out infinite",
        }}
      />
      <p className="font-sans" style={{ margin: 0, fontSize: "13px", color: "var(--t2)", fontWeight: 500 }}>
        {label}
      </p>
    </div>
  );
}

/**
 * A failed search. Retryable (a 5xx or no answer) offers Try again; otherwise
 * the route's own message, which a retry can't change. With text in the URL
 * it offers the text to edit, since the mood header isn't there to edit it.
 */
export function ResultsError({
  message,
  retryable,
  onRetry,
}: {
  message: string;
  retryable: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const text = searchParams.get("text");
  const heading = useRef<HTMLHeadingElement>(null);

  // The control that failed (a filter, Edit, Try again) is gone, so focus would fall to <body>.
  // Effects run after EditForm's autoFocus, so the message is read before the field.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const action = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "44px",
    boxSizing: "border-box",
    padding: "0 22px",
    borderRadius: "12px",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
  } as const;

  return (
    <div className="font-sans" style={{ ...column, gap: "18px" }}>
      {/* The mood header isn't rendered here, so the message is the page's heading. */}
      <h1
        ref={heading}
        tabIndex={-1}
        className="font-serif"
        style={{
          margin: 0,
          maxWidth: "560px",
          fontSize: "26px",
          fontWeight: 600,
          lineHeight: 1.25,
          color: "var(--t1)",
          outline: "none",
        }}
      >
        {retryable ? "Couldn't reach the film database." : message}
      </h1>
      {retryable ? (
        <button
          type="button"
          onClick={onRetry}
          style={{ ...action, border: "none", background: "var(--gold)", color: "var(--gold-on)", font: "inherit", fontWeight: 700, cursor: "pointer" }}
        >
          Try again
        </button>
      ) : (
        <>
          {text !== null && (
            <div style={{ width: "min(480px, 100%)" }}>
              <EditForm
                initial={text}
                // The same text would be the same 400.
                onSubmit={(value) => value !== text.trim() && router.push(withText(searchParams, value))}
              />
            </div>
          )}
          <Link href="/" style={{ ...action, border: "1px solid var(--border-h)", color: "var(--t1)" }}>
            Pick a mood
          </Link>
        </>
      )}
    </div>
  );
}
