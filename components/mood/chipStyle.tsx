import type { CSSProperties } from "react";

// Shared chip + field-label styles used across mood UI (dashboard panel,
// group mood page, refinement blocks). Kept here so the visual language
// stays consistent and no component has to redeclare them.

export function chipStyle(
  isActive: boolean,
  variant?: "exclusion",
): CSSProperties {
  return {
    padding: "7px 12px",
    borderRadius: "8px",
    fontSize: "11px",
    fontWeight: 500,
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.2s",
    userSelect: "none",
    ...(variant === "exclusion" && isActive
      ? {
          background: "var(--rose-soft)",
          color: "var(--rose)",
          borderColor: "rgba(196, 107, 124, 0.25)",
        }
      : isActive
        ? {
            background: "var(--t1)",
            color: "var(--bg)",
            borderColor: "transparent",
          }
        : {
            background: "var(--surface)",
            color: "var(--t2)",
            borderColor: "var(--border)",
          }),
  };
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="font-sans"
      style={{
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--t2)",
        marginBottom: "8px",
      }}
    >
      {children}
    </div>
  );
}
