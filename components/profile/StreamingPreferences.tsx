"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getAuthHeaders } from "@/lib/getAuthToken";
import Icon from "@/components/ui/Icon";

const PLATFORMS = [
  "Netflix",
  "Viaplay",
  "HBO Max",
  "TV 2 Play",
  "Disney+",
  "Prime Video",
];

export default function StreamingPreferences() {
  const { user } = useAuth();
  const [active, setActive] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Load on mount.
  useEffect(() => {
    if (!user) {
      setActive([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/streaming-preferences", {
          headers: await getAuthHeaders(),
        });
        if (!res.ok) throw new Error("Failed to load preferences");
        const data = await res.json();
        if (!cancelled) setActive((data.platforms ?? []) as string[]);
      } catch {
        if (!cancelled) setActive([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function toggle(platform: string) {
    if (active === null) return;
    const previous = active;
    const next = previous.includes(platform)
      ? previous.filter((p) => p !== platform)
      : [...previous, platform];
    setActive(next);
    setSaveError(false);
    setSaving(true);
    try {
      const res = await fetch("/api/streaming-preferences", {
        method: "PUT",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ platforms: next }),
      });
      if (!res.ok) throw new Error("Failed to save");
    } catch {
      setActive(previous);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2400);
    } finally {
      setSaving(false);
    }
  }

  const isLoading = active === null;
  const list = active ?? [];

  return (
    <div className="mb-4 rounded-2xl border border-(--border) bg-(--surface) p-5.5">
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[1.8px] text-(--t3)">
        Streaming in Norway
      </div>
      <p className="mb-3.5 text-xs leading-relaxed text-(--t3)">
        Select the platforms you have access to — Filmood will prioritise films
        available to you.
      </p>

      <div className="flex flex-wrap gap-2">
        {PLATFORMS.map((platform) => {
          const isActive = list.includes(platform);
          return (
            <button
              key={platform}
              onClick={() => toggle(platform)}
              disabled={isLoading || saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-[10px] border px-3.5 py-2 text-xs font-medium transition-all disabled:cursor-default disabled:opacity-60"
              style={{
                background: isActive ? "var(--teal-soft)" : "var(--surface2)",
                borderColor: isActive ? "var(--teal-border)" : "var(--border)",
                color: isActive ? "var(--teal)" : "var(--t2)",
              }}
            >
              <span
                aria-hidden
                className="rounded-full transition-colors"
                style={{
                  width: "8px",
                  height: "8px",
                  background: isActive ? "var(--teal)" : "var(--border-h)",
                }}
              />
              {platform}
              {isActive && (
                <span style={{ marginLeft: "2px" }}>
                  <Icon name="check" size={11} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      {saveError && (
        <p
          style={{
            marginTop: "10px",
            fontSize: "11px",
            color: "var(--rose)",
          }}
        >
          Couldn&apos;t save — your selection has been reverted.
        </p>
      )}
    </div>
  );
}
