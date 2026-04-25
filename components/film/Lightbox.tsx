"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MovieImage } from "@/lib/types";
import { tmdbImageUrl } from "@/lib/tmdb";

interface LightboxProps {
  images: MovieImage[];
  initialIndex: number;
  onClose: () => void;
  movieTitle: string;
}

const SWIPE_THRESHOLD = 50;

export default function Lightbox({
  images,
  initialIndex,
  onClose,
  movieTitle,
}: LightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [dragX, setDragX] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
  }, [images.length]);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prev, next]);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLImageElement>) {
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLImageElement>) {
    const start = pointerStart.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    // Only horizontal swipes — let vertical scroll pass through.
    if (Math.abs(dx) > Math.abs(dy)) {
      setDragX(dx);
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLImageElement>) {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    if (dx > SWIPE_THRESHOLD && images.length > 1) {
      prev();
    } else if (dx < -SWIPE_THRESHOLD && images.length > 1) {
      next();
    }
    setDragX(0);
  }

  if (images.length === 0) return null;

  const current = images[index];
  const displayUrl = tmdbImageUrl(
    current.file_path,
    current.kind === "poster" ? "w780" : "w1280",
  );
  const originalUrl = tmdbImageUrl(current.file_path, "original");

  const overlay = (
    <div
      ref={containerRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`${movieTitle} image gallery`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--overlay-heavy)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        outline: "none",
      }}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close gallery"
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          width: "40px",
          height: "40px",
          borderRadius: "50%",
          background: "rgba(255,255,255,0.12)",
          border: "1px solid rgba(255,255,255,0.25)",
          color: "rgba(255,255,255,0.9)",
          fontSize: "20px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        ×
      </button>

      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              prev();
            }}
            aria-label="Previous image"
            style={{
              position: "absolute",
              left: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(8, 6, 14, 0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "rgba(255,255,255,0.95)",
              fontSize: "22px",
              cursor: "pointer",
              zIndex: 2,
              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
            }}
          >
            ‹
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              next();
            }}
            aria-label="Next image"
            style={{
              position: "absolute",
              right: "12px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "44px",
              height: "44px",
              borderRadius: "50%",
              background: "rgba(8, 6, 14, 0.55)",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              border: "1px solid rgba(255,255,255,0.28)",
              color: "rgba(255,255,255,0.95)",
              fontSize: "22px",
              cursor: "pointer",
              zIndex: 2,
              boxShadow: "0 4px 14px rgba(0,0,0,0.45)",
            }}
          >
            ›
          </button>
        </>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: "calc(100vw - 120px)",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
        }}
      >
        {displayUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayUrl}
            alt={`${movieTitle} ${current.kind} ${index + 1} of ${images.length}`}
            draggable={false}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              maxWidth: "calc(100vw - 120px)",
              maxHeight: "78vh",
              objectFit: "contain",
              borderRadius: "10px",
              boxShadow: "0 16px 48px rgba(0,0,0,0.5)",
              transform: `translateX(${dragX}px)`,
              transition: dragX === 0 ? "transform 0.2s ease" : "none",
              touchAction: "pan-y",
              userSelect: "none",
            }}
          />
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "20px",
            color: "rgba(255,255,255,0.78)",
            fontSize: "12px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <span
            className="font-serif"
            style={{
              fontStyle: "italic",
              fontSize: "13px",
              color: "rgba(255,255,255,0.92)",
              letterSpacing: "1px",
            }}
          >
            {String(index + 1).padStart(2, "0")} ∕ {String(images.length).padStart(2, "0")}
          </span>

          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "1.6px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.62)",
            }}
          >
            {current.kind} · {current.width} × {current.height}
          </span>

          {originalUrl && (
            <a
              href={originalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "1.4px",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.92)",
                textDecoration: "none",
                paddingBottom: "2px",
                borderBottom: "1px solid rgba(255,255,255,0.45)",
              }}
            >
              Open original <span aria-hidden>↗</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
