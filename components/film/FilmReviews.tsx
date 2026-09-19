"use client";

import { useState } from "react";
import type { Review } from "@/lib/types";
import { formatUTCDate } from "@/lib/formatDate";

interface FilmReviewsProps {
  reviews: Review[];
}

const COLLAPSED_CHARS = 480;

function ReviewItem({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = review.content.length > COLLAPSED_CHARS;
  const shown =
    expanded || !isLong
      ? review.content
      : review.content.slice(0, COLLAPSED_CHARS).trimEnd() + "…";

  return (
    <article
      style={{
        padding: "16px 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
        }}
      >
        {review.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.avatar_url}
            alt={review.author}
            loading="lazy"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "1px solid var(--border)",
            }}
          />
        ) : (
          <div
            aria-hidden
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              background: "var(--surface2)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "13px",
              color: "var(--t2)",
              fontWeight: 600,
            }}
          >
            {review.author.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--t1)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {review.author}
          </div>
          <div style={{ fontSize: "11px", color: "var(--t3)" }}>
            {formatUTCDate(review.created_at) ?? ""}
          </div>
        </div>
        {review.rating !== null && (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "6px",
              background: "var(--gold-soft)",
              border: "1px solid var(--gold-border)",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--gold)",
              flexShrink: 0,
            }}
          >
            ★ {review.rating.toFixed(1)}
          </span>
        )}
      </div>
      <p
        style={{
          fontSize: "13px",
          lineHeight: 1.65,
          color: "var(--t1)",
          whiteSpace: "pre-wrap",
          margin: 0,
        }}
      >
        {shown}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          style={{
            marginTop: "8px",
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            color: "var(--blue)",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </article>
  );
}

export default function FilmReviews({ reviews }: FilmReviewsProps) {
  if (reviews.length === 0) return null;
  return (
    <div>
      {reviews.map((r) => (
        <ReviewItem key={r.id} review={r} />
      ))}
    </div>
  );
}
