"use client";

import { allMoods } from "@/lib/moodMap";
import { useMediaQuery } from "@/lib/useMediaQuery";
import MoodTile from "@/components/mood/MoodTile";
import MoodDescribe from "@/components/mood/MoodDescribe";
import Icon from "@/components/ui/Icon";

interface MoodPanelProps {
  isOpen: boolean;
  onClose: () => void;
  /** In the mobile BottomSheet: compact tiles, eyebrow, Close, describe field pinned below the grid. */
  embedded?: boolean;
}

export default function MoodPanel({ isOpen, onClose, embedded }: MoodPanelProps) {
  // 899, not 900: DashboardShell swaps to the sheet at the same width.
  const narrow = useMediaQuery("(max-width: 639px)");
  const medium = useMediaQuery("(max-width: 899px)");
  const columns = narrow ? 2 : medium ? 3 : 4;

  const content = (
    <>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: embedded ? "14px" : "24px" }}>
        <div style={{ flexGrow: 1, display: "flex", flexDirection: "column", gap: embedded ? "6px" : "8px" }}>
          {embedded && (
            <div
              style={{
                fontSize: "10.5px",
                fontWeight: 700,
                letterSpacing: "1.6px",
                textTransform: "uppercase",
                color: "var(--t2)",
              }}
            >
              What to watch
            </div>
          )}
          <h2
            className="font-serif"
            style={{ margin: 0, fontSize: embedded ? "24px" : "32px", fontWeight: 600, lineHeight: 1.15, color: "var(--t1)" }}
          >
            How do you want to feel?
          </h2>
          {!embedded && (
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.55, color: "var(--t2)", maxWidth: "620px" }}>
              Tap a mood to see films. On the next page you can add a second mood and set time, era and where to watch.
            </p>
          )}
        </div>
        {embedded && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              width: "44px",
              height: "44px",
              border: "1px solid var(--border-h)",
              borderRadius: "12px",
              background: "none",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <Icon name="close" size={18} />
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: embedded ? "10px" : "12px" }}>
        {allMoods.map((m) => (
          <MoodTile
            key={m.key}
            moodKey={m.key}
            href={`/results?mood=${m.key}&src=tile`}
            variant={embedded ? "compact" : "full"}
          />
        ))}
      </div>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          marginTop: embedded ? "12px" : "24px",
          paddingTop: embedded ? "12px" : "22px",
          // Pinned below the grid while the sheet's tiles scroll (§9.5).
          ...(embedded && { position: "sticky", bottom: "-24px", paddingBottom: "24px", background: "var(--surface)" }),
        }}
      >
        <MoodDescribe compact={embedded} />
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div
      // Collapsed, the panel is only hidden visually; inert keeps its tiles out of the Tab order.
      inert={!isOpen}
      style={{
        maxHeight: isOpen ? "1200px" : "0",
        opacity: isOpen ? 1 : 0,
        overflow: "hidden",
        transition: "max-height 0.5s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s, padding 0.4s",
        paddingBottom: isOpen ? "10px" : "0",
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          padding: "30px 32px 28px",
        }}
      >
        {content}
      </div>
    </div>
  );
}
