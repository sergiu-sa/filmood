"use client";

import { useRef, type KeyboardEvent } from "react";
import Icon from "@/components/ui/Icon";

interface FilterGroupProps<V extends string> {
  /** The radiogroup's accessible name, and the visible label unless hideLabel. */
  label: string;
  /** `controls` names the popover an option opens, while it's open. */
  options: { value: V | null; label: string; hint?: string; controls?: string }[];
  value: V | null;
  onChange: (value: V | null) => void;
  /** vertical: 48px rows with a check on the selected one (sheets, and the group page below 900). */
  orientation?: "horizontal" | "vertical";
  hideLabel?: boolean;
}

/**
 * A segmented radio group for one filter. Roving tabindex: Tab lands on the
 * checked option, arrows move focus without selecting (each selection is a
 * search), Space or Enter selects.
 */
export default function FilterGroup<V extends string>({
  label,
  options,
  value,
  onChange,
  orientation = "horizontal",
  hideLabel = false,
}: FilterGroupProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const vertical = orientation === "vertical";
  // The checked option, or the first when none is.
  const tabbable = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const step =
      e.key === (vertical ? "ArrowDown" : "ArrowRight") ? 1 : e.key === (vertical ? "ArrowUp" : "ArrowLeft") ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const current = refs.current.findIndex((el) => el === document.activeElement);
    const next = (Math.max(current, 0) + step + options.length) % options.length;
    refs.current[next]?.focus();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: vertical ? "column" : "row",
        alignItems: vertical ? "stretch" : "center",
        gap: "10px",
      }}
    >
      {!hideLabel && (
        <span
          aria-hidden="true"
          className="font-sans"
          style={{
            fontSize: "10.5px",
            fontWeight: 700,
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            color: "var(--t2)",
          }}
        >
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={label}
        aria-orientation={orientation}
        onKeyDown={onKeyDown}
        style={
          vertical
            ? { display: "flex", flexDirection: "column", gap: "6px" }
            : {
                display: "flex",
                gap: "2px",
                padding: "3px",
                background: "var(--surface2)",
                borderRadius: "11px",
              }
        }
      >
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value ?? "any"}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-controls={o.controls}
              tabIndex={i === tabbable ? 0 : -1}
              onClick={() => {
                if (!checked) onChange(o.value);
              }}
              className="font-sans"
              style={vertical ? rowStyle(checked) : segmentStyle(checked)}
            >
              <span>
                {o.label}
                {o.hint && (
                  <span style={{ color: "var(--t2)", fontWeight: 400 }}>
                    <span aria-hidden="true"> · </span>
                    {o.hint}
                  </span>
                )}
              </span>
              {vertical && checked && <Icon name="check" size={18} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Filters are neutral: the selected option is inverted chalk, never a mood accent.
function segmentStyle(checked: boolean) {
  return {
    height: "34px",
    boxSizing: "border-box",
    padding: "0 12px",
    border: "none",
    borderRadius: "8px",
    fontSize: "12.5px",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: checked ? "default" : "pointer",
    background: checked ? "var(--t1)" : "transparent",
    color: checked ? "var(--bg)" : "var(--t2)",
  } as const;
}

function rowStyle(checked: boolean) {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    minHeight: "48px",
    boxSizing: "border-box",
    padding: "0 14px",
    borderRadius: "12px",
    border: `1px solid ${checked ? "var(--border-h)" : "transparent"}`,
    background: checked ? "var(--surface2)" : "transparent",
    color: "var(--t1)",
    fontSize: "15px",
    fontWeight: checked ? 600 : 500,
    textAlign: "left",
    cursor: checked ? "default" : "pointer",
  } as const;
}
