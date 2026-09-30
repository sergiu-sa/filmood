"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { PLATFORMS, type PlatformSlug } from "@/lib/platforms";

/** The picker's heading, and the name of the popover or sheet that holds it. */
export const PICKER_TITLE = "Which services do you have?";

interface ServicesPickerProps {
  initial: PlatformSlug[];
  signedIn: boolean;
  /** Q4: saves to the profile, no checkbox. */
  saved: boolean;
  onConfirm: (slugs: PlatformSlug[], toProfile: boolean) => Promise<void>;
  onCancel: () => void;
}

/** "My services" with nothing known, or Edit services. FilterBar places it in a popover or a sheet. */
export default function ServicesPicker({ initial, signedIn, saved, onConfirm, onCancel }: ServicesPickerProps) {
  const [picked, setPicked] = useState<PlatformSlug[]>(initial);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const count = picked.length;
  const toProfile = saved || (signedIn && saveToProfile);

  const toggle = (slug: PlatformSlug) =>
    setPicked((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (count === 0 || pending) return;
    setPending(true);
    setFailed(false);
    try {
      await onConfirm(
        PLATFORMS.filter((p) => picked.includes(p.slug)).map((p) => p.slug),
        toProfile,
      );
    } catch {
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} className="font-sans" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <h2
          className="font-serif"
          style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "var(--t1)" }}
        >
          {PICKER_TITLE}
        </h2>
        <p style={{ margin: 0, fontSize: "13px", lineHeight: 1.5, color: "var(--t2)" }}>
          We&apos;ll only show films you can stream in Norway tonight.
        </p>
      </div>

      <fieldset
        style={{
          margin: 0,
          padding: 0,
          border: "none",
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: "8px",
        }}
      >
        <legend className="sr-only">Streaming services</legend>
        {PLATFORMS.map((p, i) => {
          const on = picked.includes(p.slug);
          return (
            <label
              key={p.slug}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                height: "48px",
                boxSizing: "border-box",
                padding: "0 12px",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 600,
                color: "var(--t1)",
                background: on ? "var(--gold-soft)" : "var(--surface2)",
                border: `1px solid ${on ? "rgba(var(--gold-rgb), 0.45)" : "var(--border)"}`,
              }}
            >
              <input
                ref={i === 0 ? firstRef : undefined}
                type="checkbox"
                checked={on}
                onChange={() => toggle(p.slug)}
                style={{ width: "18px", height: "18px", margin: 0, accentColor: "var(--gold)" }}
              />
              {p.name}
            </label>
          );
        })}
      </fieldset>

      <div style={{ fontSize: "12.5px", color: "var(--t2)" }}>
        {saved ? (
          <p style={{ margin: 0 }}>Saved to your profile</p>
        ) : signedIn ? (
          <label style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "44px", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={saveToProfile}
              onChange={(e) => setSaveToProfile(e.target.checked)}
              style={{ width: "18px", height: "18px", margin: 0, accentColor: "var(--gold)" }}
            />
            Save to my profile
          </label>
        ) : (
          <p style={{ margin: 0 }}>
            Remembered on this device ·{" "}
            <Link href="/signup" style={{ color: "var(--gold)", fontWeight: 700, textDecoration: "none" }}>
              Sign up to keep them everywhere
            </Link>
          </p>
        )}
      </div>

      {failed && (
        <p role="alert" style={{ margin: 0, fontSize: "13px", color: "var(--rose)" }}>
          Couldn&apos;t save to your profile. Try again.
        </p>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          justifyContent: "flex-end",
          paddingTop: "12px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: "44px",
            padding: "0 16px",
            borderRadius: "11px",
            background: "transparent",
            border: "1px solid var(--border-h)",
            color: "var(--t1)",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={count === 0 || pending}
          style={{
            height: "44px",
            padding: "0 20px",
            borderRadius: "11px",
            border: "none",
            fontSize: "14px",
            fontWeight: 700,
            cursor: count === 0 ? "not-allowed" : "pointer",
            background: count === 0 ? "var(--surface2)" : "var(--gold)",
            color: count === 0 ? "var(--t2)" : "var(--accent-ink)",
          }}
        >
          {count === 0 ? "Pick at least one" : `Show films on ${count} service${count === 1 ? "" : "s"}`}
        </button>
      </div>
    </form>
  );
}
