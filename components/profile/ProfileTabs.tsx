"use client";

import { useState } from "react";

export type ProfileTab =
  | "taste"
  | "films"
  | "activity"
  | "account"
  | "settings";

interface TabDef {
  id: ProfileTab;
  label: string;
}

const TABS: TabDef[] = [
  { id: "taste", label: "Taste" },
  { id: "films", label: "Films" },
  { id: "activity", label: "Activity" },
  { id: "account", label: "Account" },
  { id: "settings", label: "Settings" },
];

interface ProfileTabsProps {
  active: ProfileTab;
  counts?: Partial<Record<ProfileTab, number>>;
  onChange: (tab: ProfileTab) => void;
}

export default function ProfileTabs({
  active,
  counts,
  onChange,
}: ProfileTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Profile sections"
      className="mb-7 flex gap-6 overflow-x-auto px-1"
      style={{
        borderBottom: "1px solid var(--border)",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      {TABS.map((t) => {
        const isActive = active === t.id;
        const count = counts?.[t.id];
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className="relative inline-flex items-baseline gap-2 cursor-pointer"
            style={{
              padding: "14px 0 12px",
              marginBottom: "-1px",
              background: "transparent",
              border: 0,
              borderBottom: isActive
                ? "2px solid var(--gold)"
                : "2px solid transparent",
              transition: "border-color 0.2s ease",
            }}
          >
            <span
              className="font-serif"
              style={{
                fontSize: "15px",
                fontWeight: 600,
                color: isActive ? "var(--t1)" : "var(--t3)",
                letterSpacing: "-0.2px",
                whiteSpace: "nowrap",
                transition: "color 0.2s ease",
              }}
            >
              {t.label}
            </span>
            {typeof count === "number" && count > 0 && (
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1.4px",
                  color: isActive ? "var(--gold)" : "var(--t3)",
                  transition: "color 0.2s ease",
                }}
              >
                {String(count).padStart(2, "0")}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/**
 * Hook: keep the active tab in sync with the URL hash so deep-linking works
 * (e.g. share `/profile#films`). Falls back to "taste" on mount.
 */
export function useProfileTab(initial: ProfileTab = "taste"): [
  ProfileTab,
  (tab: ProfileTab) => void,
] {
  const [tab, setTab] = useState<ProfileTab>(() => {
    if (typeof window === "undefined") return initial;
    const hash = window.location.hash.replace("#", "") as ProfileTab;
    return TABS.some((t) => t.id === hash) ? hash : initial;
  });

  function update(next: ProfileTab) {
    setTab(next);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${next}`);
    }
  }

  return [tab, update];
}
