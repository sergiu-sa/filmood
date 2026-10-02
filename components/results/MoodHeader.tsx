"use client";

import { Fragment, useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomSheet from "@/components/dashboard/BottomSheet";
import MoodTile from "@/components/mood/MoodTile";
import Icon from "@/components/ui/Icon";
import { ACCENT_VARS } from "@/lib/constants";
import { ERA_OPTIONS, TIME_OPTIONS } from "@/lib/moodFilters";
import { MAX_MOODS, moodMap, normalizeMoodKeys } from "@/lib/moodMap";
import { useDismiss } from "@/lib/useDismiss";
import { useMediaQuery } from "@/lib/useMediaQuery";
import type { SearchSource } from "@/lib/searchLog";
import type { AppliedFilters, DiscoverResponse } from "@/lib/types";

interface MoodHeaderProps {
  moods: DiscoverResponse["moods"];
  interpreted: DiscoverResponse["interpreted"];
  droppedMoods: string[];
  /** As the response applied them: a Time or Era read from the text is echoed only while it's in effect. */
  filters: AppliedFilters;
  /** The page is fetching a newer URL than these props answer. */
  busy: boolean;
}

const ADD_TITLE = "Add a mood";
const MAX_TEXT_LENGTH = 120;

const moodList = new Intl.ListFormat("en-GB", { type: "conjunction" });
const tagLabel = (key: string) => (Object.hasOwn(moodMap, key) ? moodMap[key].tagLabel : key);

/** The results URL with these tile moods (none: `mood` removed), everything else kept, and `src` set. */
export function withMoods(sp: URLSearchParams, keys: string[], src: SearchSource): URLSearchParams {
  const next = new URLSearchParams(sp);
  if (keys.length > 0) next.set("mood", keys.join(","));
  else next.delete("mood");
  next.set("src", src);
  return next;
}

/** Where a new free text goes: the results URL with it (empty: `text` removed), or home when no mood would be left. */
export function withText(sp: URLSearchParams, value: string): string {
  const next = new URLSearchParams(sp);
  // `any` only cancelled the old text's Time or Era; a new text is read afresh.
  for (const key of ["time", "era"]) if (next.get(key) === "any") next.delete(key);
  if (value) next.set("text", value);
  else next.delete("text");
  if (!value && normalizeMoodKeys((next.get("mood") ?? "").split(",")).length === 0) return "/";
  next.set("src", "text");
  return `/results?${next}`;
}

/**
 * The results page's title, mood chips, add-mood popover (a sheet on mobile)
 * and the line echoing how the free text was read. Mood and text changes push,
 * so Back returns to the previous search.
 */
export default function MoodHeader({ moods, interpreted, droppedMoods, filters, busy }: MoodHeaderProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 900px)");
  // Open only on the URL it was opened on, so a picked tile, Back or Forward closes it. Not src: the page strips it once it has fetched.
  const here = new URLSearchParams(searchParams);
  here.delete("src");
  const urlKey = here.toString();
  const [addingAt, setAddingAt] = useState<string | null>(null);
  const [editingAt, setEditingAt] = useState<string | null>(null);
  const adding = addingAt === urlKey;
  const editing = editingAt === urlKey;
  const addRef = useRef<HTMLLIElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);

  const textMoods = interpreted?.moods ?? [];
  // Removing a mood the text read would do nothing: the text brings it straight back (Q6).
  const tileMoods = moods.map((m) => m.key).filter((k) => !textMoods.includes(k));
  const full = moods.length >= MAX_MOODS;
  const others = Object.keys(moodMap).filter((k) => !moods.some((m) => m.key === k));

  const closeAdd = () => {
    setAddingAt(null);
    addButtonRef.current?.focus();
  };
  useDismiss(addRef, adding && !isMobile, closeAdd, () => setAddingAt(null));

  const closeEdit = () => {
    setEditingAt(null);
    // The Edit button is back only after this render.
    requestAnimationFrame(() => editButtonRef.current?.focus());
  };

  // While busy these props are the last answer, not the URL's, so acting on them would undo or repeat a change.
  const remove = (key: string) => {
    if (busy) return;
    const rest = tileMoods.filter((k) => k !== key);
    // Text with no mood word of its own is a 400 from the route.
    if (rest.length === 0 && textMoods.length === 0) {
      router.push("/");
      return;
    }
    router.push(`/results?${withMoods(searchParams, rest, "filter")}`);
    // This chip goes when the answer lands.
    addButtonRef.current?.focus();
  };

  const submitText = (value: string) => {
    // The same query fetches nothing, and the page strips src only when it fetches, so src=text would stick.
    if (value === interpreted?.text) {
      closeEdit();
      return;
    }
    const href = withText(searchParams, value);
    router.push(href);
    if (href !== "/") closeEdit();
  };

  const tiles = (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "repeat(2, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
        gap: "10px",
      }}
    >
      {others.map((key) => (
        <MoodTile key={key} moodKey={key} href={`/results?${withMoods(searchParams, [...tileMoods, key], "tile")}`} />
      ))}
    </div>
  );

  const chipHeight = isMobile ? "44px" : "38px";
  const chipFont = isMobile ? "12.5px" : "13px";

  return (
    <div style={{ width: "100%", marginBottom: "24px" }}>
      {/* The popover is positioned against this row, so it stays in the column when the chips wrap. */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          flexWrap: "wrap",
          alignItems: isMobile ? "stretch" : "flex-end",
          justifyContent: "space-between",
          gap: isMobile ? "12px" : "16px 24px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? "8px" : "10px" }}>
          <p
            className="font-sans"
            style={{
              margin: 0,
              fontSize: isMobile ? "10.5px" : "11px",
              fontWeight: 700,
              letterSpacing: isMobile ? "1.6px" : "1.8px",
              textTransform: "uppercase",
              color: "var(--gold)",
            }}
          >
            {moods.length > 1 ? "What to watch · blended" : "What to watch"}
          </p>
          <h1
            className="font-serif"
            style={{
              margin: 0,
              fontSize: isMobile ? "32px" : "46px",
              fontWeight: 600,
              lineHeight: 1.08,
              letterSpacing: "-0.5px",
              color: "var(--t1)",
            }}
          >
            {moods.map((m, i) => (
              <Fragment key={m.key}>
                {i > 0 && (
                  <>
                    {" "}
                    <span style={{ fontStyle: "italic", fontWeight: 500, color: "var(--t2)" }}>+</span>{" "}
                  </>
                )}
                {m.label}
              </Fragment>
            ))}
          </h1>
          {moods.length === 1 && !isMobile && Object.hasOwn(moodMap, moods[0].key) && (
            <p className="font-sans" style={{ margin: 0, fontSize: "15px", color: "var(--t2)" }}>
              {moodMap[moods[0].key].description}.
            </p>
          )}
        </div>

        <div
          style={{ display: "flex", flexDirection: "column", alignItems: isMobile ? "flex-start" : "flex-end", gap: "8px" }}
        >
          <ul
            aria-label="Moods"
            className="font-sans"
            style={{ display: "flex", flexWrap: "wrap", gap: "8px", margin: 0, padding: 0, listStyle: "none" }}
          >
            {moods.map((m) => {
              const accent = ACCENT_VARS[m.accent];
              const removable = tileMoods.includes(m.key);
              return (
                <li
                  key={m.key}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: isMobile ? "6px" : "8px",
                    height: chipHeight,
                    boxSizing: "border-box",
                    padding: removable ? (isMobile ? "0 0 0 12px" : "0 8px 0 14px") : isMobile ? "0 12px" : "0 14px",
                    borderRadius: "999px",
                    background: accent.soft,
                    border: `1px solid ${accent.border}`,
                    // Accent text on its own soft fill is under 4.5:1 in light mode; the dot, border and fill carry the mood.
                    color: "var(--t1)",
                    fontSize: chipFont,
                    fontWeight: 600,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{ width: "8px", height: "8px", borderRadius: "50%", background: accent.base, flexShrink: 0 }}
                  />
                  <span>{m.label}</span>
                  {removable && (
                    <button
                      type="button"
                      aria-label={`Remove ${m.label}`}
                      aria-disabled={busy || undefined}
                      onClick={() => remove(m.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: isMobile ? "44px" : "26px",
                        height: isMobile ? "44px" : "26px",
                        padding: 0,
                        borderRadius: "50%",
                        border: "none",
                        background: "transparent",
                        color: "inherit",
                        cursor: busy ? "progress" : "pointer",
                      }}
                    >
                      <Icon name="close" size={isMobile ? 13 : 14} />
                    </button>
                  )}
                </li>
              );
            })}
            <li ref={addRef}>
              <button
                ref={addButtonRef}
                type="button"
                // aria-disabled, not disabled: it stays focusable, so a remove can hand focus to it.
                aria-disabled={full || busy || undefined}
                aria-haspopup={full ? undefined : "dialog"}
                aria-expanded={full ? undefined : adding}
                onClick={() => {
                  if (full || busy) return;
                  if (adding) closeAdd();
                  else setAddingAt(urlKey);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: isMobile ? "6px" : "8px",
                  height: chipHeight,
                  boxSizing: "border-box",
                  padding: isMobile ? "0 12px" : "0 16px",
                  borderRadius: "999px",
                  background: "transparent",
                  border: "1px dashed var(--border-h)",
                  color: full ? "var(--t2)" : "var(--t1)",
                  font: "inherit",
                  fontSize: chipFont,
                  fontWeight: 600,
                  cursor: full ? "default" : busy ? "progress" : "pointer",
                }}
              >
                {full ? (
                  `${MAX_MOODS} of ${MAX_MOODS} moods`
                ) : (
                  <>
                    <Icon name="plus" size={isMobile ? 13 : 14} />
                    {ADD_TITLE}
                  </>
                )}
              </button>
              {adding && !isMobile && <AddPopover>{tiles}</AddPopover>}
            </li>
          </ul>
          {droppedMoods.length > 0 && (
            <p className="font-sans" style={{ margin: 0, fontSize: "13px", color: "var(--t2)" }}>
              {`Two moods at a time — left out ${moodList.format(droppedMoods.map(tagLabel))}.`}
            </p>
          )}
        </div>
      </div>

      {/* FilterBar keeps its BottomSheet mounted; this one exists only while open, so there's never a second at rest. */}
      {adding && isMobile && (
        <BottomSheet isOpen onClose={closeAdd} label={ADD_TITLE}>
          <div className="font-sans" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 className="font-serif" style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "var(--t1)" }}>
                {ADD_TITLE}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={closeAdd}
                style={{
                  width: "44px",
                  height: "44px",
                  border: "none",
                  background: "transparent",
                  color: "var(--t2)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            {tiles}
          </div>
        </BottomSheet>
      )}

      {interpreted && (
        <div className="font-sans" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "14px" }}>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.6, color: "var(--t2)" }}>
            <span style={{ display: "inline-block", verticalAlign: "-2px", marginRight: "8px" }}>
              <Icon name="pencil" size={15} />
            </span>
            <Reading interpreted={interpreted} moods={moods} filters={filters} />
            {!editing && (
              <button
                ref={editButtonRef}
                type="button"
                aria-disabled={busy || undefined}
                onClick={() => !busy && setEditingAt(urlKey)}
                style={{
                  // A 44px target: the margins take back the padding, so the line doesn't grow.
                  padding: "12px 10px",
                  margin: "-12px -10px -12px -2px",
                  border: "none",
                  background: "none",
                  color: "var(--gold)",
                  font: "inherit",
                  fontWeight: 700,
                  cursor: busy ? "progress" : "pointer",
                }}
              >
                Edit
              </button>
            )}
          </p>
          {hasMatch(interpreted) && interpreted.unmatched.length > 0 && (
            <p style={{ margin: 0, fontSize: "13px", color: "var(--t2)" }}>
              {`Didn't recognise: ${interpreted.unmatched.join(", ")}.`}
            </p>
          )}
          {editing && (
            <EditForm
              initial={interpreted.text}
              onSubmit={submitText}
              onCancel={closeEdit}
            />
          )}
        </div>
      )}
    </div>
  );
}

function AddPopover({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("a")?.focus();
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={ADD_TITLE}
      style={{
        position: "absolute",
        top: "calc(100% + 8px)",
        right: 0,
        zIndex: 45,
        width: "min(660px, 100%)",
        boxSizing: "border-box",
        padding: "16px",
        background: "var(--surface)",
        border: "1px solid var(--border-h)",
        borderRadius: "18px",
        boxShadow: "0 24px 60px var(--overlay-scrim)",
      }}
    >
      {children}
    </div>
  );
}

type Interpreted = NonNullable<DiscoverResponse["interpreted"]>;

const hasMatch = (r: Interpreted) => r.moods.length > 0 || r.era !== null || r.time !== null;

/** "We read “…” as Go dark · Long & immersive." Only what's in effect: not a text mood past the cap, nor a Time or Era the bar overrode. */
function Reading({
  interpreted,
  moods,
  filters,
}: {
  interpreted: Interpreted;
  moods: DiscoverResponse["moods"];
  filters: AppliedFilters;
}) {
  const quoted = <span style={{ color: "var(--t1)", fontWeight: 600 }}>“{interpreted.text}”</span>;
  if (!hasMatch(interpreted)) return <span>Nothing in {quoted} matched a mood or filter.</span>;

  const applied = moods.filter((m) => interpreted.moods.includes(m.key));
  const labels = [
    filters.time !== null && filters.time === interpreted.time
      ? TIME_OPTIONS.find((o) => o.value === interpreted.time)?.label
      : undefined,
    filters.era !== null && filters.era === interpreted.era
      ? ERA_OPTIONS.find((o) => o.value === interpreted.era)?.label
      : undefined,
  ].filter((l): l is string => l !== undefined);
  if (applied.length === 0 && labels.length === 0) return <span>Nothing from {quoted} applies right now.</span>;

  return (
    <span>
      We read {quoted} as{" "}
      {applied.map((m, i) => (
        <span key={m.key}>
          {i > 0 && " + "}
          <span style={{ color: ACCENT_VARS[m.accent].base, fontWeight: 700 }}>{m.label}</span>
        </span>
      ))}
      {labels.map((label, i) => (
        <span key={label}>
          {(applied.length > 0 || i > 0) && " · "}
          <span style={{ color: "var(--t1)", fontWeight: 600 }}>{label}</span>
        </span>
      ))}
      .
    </span>
  );
}

/** Mounted per open, so a cancelled draft doesn't come back. Without onCancel there's no Cancel. */
export function EditForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: string;
  onSubmit: (text: string) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(initial);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(draft.trim());
  };

  const button = {
    height: "44px",
    borderRadius: "11px",
    font: "inherit",
    fontSize: "14px",
    cursor: "pointer",
  } as const;

  return (
    <form onSubmit={submit} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "4px" }}>
      <label htmlFor="describe-mood" className="sr-only">
        Describe your mood
      </label>
      <input
        id="describe-mood"
        autoFocus
        value={draft}
        maxLength={MAX_TEXT_LENGTH}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
        style={{
          flex: "1 1 240px",
          maxWidth: "480px",
          height: "44px",
          boxSizing: "border-box",
          padding: "0 14px",
          borderRadius: "11px",
          border: "1px solid var(--border-h)",
          background: "var(--surface)",
          color: "var(--t1)",
          font: "inherit",
          fontSize: "14px",
        }}
      />
      <button
        type="submit"
        style={{ ...button, padding: "0 18px", border: "none", background: "var(--gold)", color: "var(--accent-ink)", fontWeight: 700 }}
      >
        Search
      </button>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          style={{ ...button, padding: "0 16px", border: "1px solid var(--border-h)", background: "transparent", color: "var(--t1)", fontWeight: 600 }}
        >
          Cancel
        </button>
      )}
    </form>
  );
}
