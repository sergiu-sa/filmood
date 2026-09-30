"use client";

import { useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import BottomSheet from "@/components/dashboard/BottomSheet";
import FilterGroup from "@/components/mood/FilterGroup";
import ServicesPicker, { PICKER_TITLE } from "@/components/results/ServicesPicker";
import Icon from "@/components/ui/Icon";
import { filmCount, filmWord } from "@/lib/filmCount";
import { ANY_LABELS, ERA_OPTIONS, setFilterParam, TIME_OPTIONS, WHERE_OPTIONS, type FilterKey } from "@/lib/moodFilters";
import { parseServices, platformsFor, type PlatformSlug } from "@/lib/platforms";
import { newSeed } from "@/lib/seededRandom";
import { useDismiss } from "@/lib/useDismiss";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useServices } from "@/lib/useServices";
import type { AppliedFilters } from "@/lib/types";

interface FilterBarProps {
  /** As the response applied them. */
  filters: AppliedFilters;
  count: number;
  /** The page is fetching a different query from the one on screen. */
  busy: boolean;
}

type Sheet = FilterKey | "services";

const PICKER_ID = "services-picker";

const SHEET_TITLES: Record<FilterKey, string> = {
  time: "How much time?",
  era: "Which era?",
  where: "Where can you watch?",
};

const SHORT = {
  time: [{ value: null, label: "Any" }, ...TIME_OPTIONS.map((o) => ({ value: o.value, label: o.short }))],
  era: [{ value: null, label: "Any" }, ...ERA_OPTIONS.map((o) => ({ value: o.value, label: o.short }))],
  where: WHERE_OPTIONS.map((o) => ({ value: o.value, label: o.short })),
};

const LONG = {
  time: [
    { value: null, label: ANY_LABELS.time },
    ...TIME_OPTIONS.map((o) => ({ value: o.value, label: o.label, hint: o.hint })),
  ],
  era: [{ value: null, label: ANY_LABELS.era }, ...ERA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))],
  where: WHERE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
};

const serviceList = new Intl.ListFormat("en-GB", { type: "conjunction" });

/**
 * The results page's Time · Era · Where bar, count and Shuffle: a sticky bar on
 * desktop, a chip row with one sheet on mobile. It writes the URL with
 * router.replace and keeps the seed (Shuffle replaces it); the page refetches.
 */
export default function FilterBar({ filters, count, busy }: FilterBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useMediaQuery("(max-width: 900px)");
  const services = useServices();
  const [pending, setPending] = useState<{ url: string; key: FilterKey; value: string | null } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // A new key per open: the mobile sheet keeps its content mounted, and a
  // reopened picker must start from the current list, not the last edit.
  const [pickerKey, setPickerKey] = useState(0);
  const openerRef = useRef<HTMLElement | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; kind: Sheet }>({ open: false, kind: "time" });
  const whereRef = useRef<HTMLDivElement>(null);

  // What "My services" searched: saved services win in resolveWhere, and
  // discoverQuery sends the URL's (a shared link's) over this device's.
  const urlServices = parseServices(searchParams.get("services"));
  const known = services.saved || urlServices.length === 0 ? services.list : urlServices;

  const current = new URLSearchParams(searchParams);
  current.delete("src");
  // The pick shows only while the URL is still the one it wrote; any other
  // search (a suggestion, Shuffle) shows what the response applied.
  const shown = <K extends FilterKey>(key: K): AppliedFilters[K] =>
    busy && pending?.key === key && pending.url === current.toString()
      ? (pending.value as AppliedFilters[K])
      : filters[key];

  const write = (next: URLSearchParams, src: "filter" | "shuffle") => {
    next.set("src", src);
    router.replace(`/results?${next}`, { scroll: false });
  };

  const apply = (key: FilterKey, value: string | null, services?: readonly PlatformSlug[]) => {
    const next = setFilterParam(searchParams, key, value);
    next.delete("src");
    // Every write of where=mine carries its services, so an edit to the same
    // Where still changes the URL, and the request says what it searched.
    if (services) next.set("services", services.join(","));
    setPending({ url: next.toString(), key, value });
    write(next, "filter");
  };

  const openPicker = () => {
    setPickerKey((k) => k + 1);
    if (isMobile) {
      setSheet({ open: true, kind: "services" });
    } else {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setPickerOpen(true);
    }
  };

  const closePicker = () => {
    setPickerOpen(false);
    const opener = openerRef.current;
    // Safari doesn't focus a clicked button, so the opener can be body; My
    // services, the Where group's first radio, is the fallback.
    const target =
      opener && opener !== document.body && opener.isConnected
        ? opener
        : whereRef.current?.querySelector<HTMLElement>('[role="radio"]');
    target?.focus();
  };
  useDismiss(whereRef, pickerOpen, closePicker);

  const choose = (key: FilterKey, value: string | null) => {
    if (key === "where" && value === "mine" && known.length === 0) {
      openPicker();
      return;
    }
    setPickerOpen(false);
    apply(key, value, key === "where" && value === "mine" ? known : undefined);
  };

  const confirmServices = async (slugs: PlatformSlug[], toProfile: boolean) => {
    await services.save(slugs, toProfile);
    if (isMobile) setSheet((s) => ({ ...s, open: false }));
    else closePicker();
    apply("where", "mine", slugs);
  };

  const shuffle = () => {
    const next = new URLSearchParams(searchParams);
    next.set("seed", String(newSeed()));
    write(next, "shuffle");
  };

  const mine = filters.where === "mine" && known.length > 0;
  const names = platformsFor(known).map((p) => p.name);
  const countText = (
    <>
      <strong style={{ color: "var(--t1)", fontWeight: 700 }}>{count}</strong> {filmWord(count)}
    </>
  );

  // The open sheet is aria-modal, so it carries its own live region and this one stays quiet.
  const liveRegion = (
    <p aria-live="polite" className="sr-only">
      {busy || sheet.open ? "" : filmCount(count)}
    </p>
  );

  const pickerProps = {
    initial: known,
    signedIn: services.signedIn,
    saved: services.saved,
    onConfirm: confirmServices,
  };

  if (isMobile) {
    const closeSheet = () => setSheet((s) => ({ ...s, open: false }));
    const chip = (key: FilterKey) => {
      const value = shown(key);
      const label = SHORT[key].find((o) => o.value === value)?.label ?? "Any";
      return (
        <button
          key={key}
          type="button"
          aria-haspopup="dialog"
          onClick={() => setSheet({ open: true, kind: key })}
          className="font-sans"
          style={{
            display: "inline-flex",
            flexShrink: 0,
            alignItems: "center",
            gap: "6px",
            height: "44px",
            boxSizing: "border-box",
            padding: "0 12px",
            borderRadius: "10px",
            background: "var(--surface2)",
            border: "1px solid var(--border-h)",
            color: "var(--t1)",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <span style={{ color: "var(--t2)", fontWeight: 500 }}>{key === "time" ? "Time" : key === "era" ? "Era" : "Where"}</span>{" "}
          {label}
          <Icon name="chevron-down" size={14} />
        </button>
      );
    };
    const kind = sheet.kind;

    return (
      <>
        <section
          aria-label="Filters"
          style={{
            position: "sticky",
            top: "var(--sticky-header-h, 0px)",
            zIndex: 40,
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 0",
            background: "var(--bg)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", flex: 1, minWidth: 0 }}>
            {(["time", "era", "where"] as const).map(chip)}
          </div>
          <button
            type="button"
            aria-label="Shuffle results"
            onClick={shuffle}
            style={{
              flexShrink: 0,
              width: "44px",
              height: "44px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "10px",
              background: "var(--surface)",
              border: "1px solid var(--border-h)",
              color: "var(--t1)",
              cursor: "pointer",
            }}
          >
            <Icon name="shuffle" size={16} />
          </button>
        </section>
        <p
          className="font-sans"
          style={{
            width: "100%",
            minHeight: "44px",
            margin: "4px 0 8px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            columnGap: "4px",
            fontSize: "12.5px",
            color: "var(--t2)",
          }}
        >
          <span>
            {countText}
            {mine && ` on ${names.join(", ")}`}
          </span>
          {mine && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={openPicker}
                style={{ ...editStyle, minHeight: "44px" }}
              >
                Edit services
              </button>
            </>
          )}
        </p>
        {liveRegion}

        <BottomSheet isOpen={sheet.open} onClose={closeSheet} label={kind === "services" ? PICKER_TITLE : SHEET_TITLES[kind]}>
          {kind === "services" ? (
            <ServicesPicker key={pickerKey} {...pickerProps} onCancel={closeSheet} />
          ) : (
            <div className="font-sans" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "8px" }}>
                <h2 className="font-serif" style={{ margin: 0, fontSize: "22px", fontWeight: 600, color: "var(--t1)" }}>
                  {SHEET_TITLES[kind]}
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={closeSheet}
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
              <p aria-live="polite" className="sr-only">
                {busy ? "" : filmCount(count)}
              </p>
              <FilterGroup
                label={SHEET_TITLES[kind]}
                hideLabel
                orientation="vertical"
                options={LONG[kind]}
                value={shown(kind)}
                onChange={(value) => choose(kind, value)}
              />
              <button
                type="button"
                onClick={closeSheet}
                style={{
                  marginTop: "12px",
                  height: "52px",
                  borderRadius: "12px",
                  border: "none",
                  background: "var(--gold)",
                  color: "var(--accent-ink)",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {busy ? "Finding films…" : `Show ${filmCount(count)}`}
              </button>
            </div>
          )}
        </BottomSheet>
      </>
    );
  }

  return (
    <>
      <section
        aria-label="Filters"
        className="font-sans"
        style={{
          position: "sticky",
          top: "var(--sticky-header-h, 0px)",
          zIndex: 40,
          width: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px 22px",
          padding: "10px 12px 10px 18px",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          boxShadow: "0 10px 30px var(--overlay-weak)",
        }}
      >
        <FilterGroup label="Time" options={SHORT.time} value={shown("time")} onChange={(v) => choose("time", v)} />
        <FilterGroup label="Era" options={SHORT.era} value={shown("era")} onChange={(v) => choose("era", v)} />
        <div ref={whereRef} style={{ position: "relative" }}>
          <FilterGroup
            label="Where"
            options={SHORT.where.map((o) => (o.value === "mine" && pickerOpen ? { ...o, controls: PICKER_ID } : o))}
            value={shown("where")}
            onChange={(v) => choose("where", v)}
          />
          {pickerOpen && (
            <div
              id={PICKER_ID}
              role="dialog"
              aria-label={PICKER_TITLE}
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                zIndex: 45,
                width: "400px",
                boxSizing: "border-box",
                padding: "22px 22px 20px",
                background: "var(--surface)",
                border: "1px solid var(--border-h)",
                borderRadius: "18px",
                boxShadow: "0 24px 60px var(--overlay-scrim)",
              }}
            >
              <ServicesPicker key={pickerKey} {...pickerProps} onCancel={closePicker} />
            </div>
          )}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "var(--t2)", whiteSpace: "nowrap" }}>{countText}</span>
          <button
            type="button"
            onClick={shuffle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              height: "40px",
              boxSizing: "border-box",
              padding: "0 14px",
              borderRadius: "10px",
              background: "transparent",
              border: "1px solid var(--border-h)",
              color: "var(--t1)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Icon name="shuffle" size={15} />
            Shuffle
          </button>
        </div>
      </section>
      {liveRegion}
      {mine && (
        <p
          className="font-sans"
          style={{ width: "100%", margin: "10px 0 0", paddingLeft: "4px", fontSize: "12.5px", color: "var(--t2)" }}
        >
          Showing films on <span style={{ color: "var(--t1)" }}>{serviceList.format(names)}</span> in Norway ·{" "}
          <button type="button" onClick={openPicker} style={editStyle}>
            Edit services
          </button>
        </p>
      )}
    </>
  );
}

const editStyle = {
  padding: 0,
  border: "none",
  background: "none",
  color: "var(--gold)",
  font: "inherit",
  fontWeight: 600,
  cursor: "pointer",
} as const;
