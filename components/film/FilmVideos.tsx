"use client";

import { useMemo, useState } from "react";
import type { MovieVideo } from "@/lib/types";

interface FilmVideosProps {
  videos: MovieVideo[];
}

type AccentKey = "gold" | "blue" | "rose" | "violet" | "teal" | "ember";

type VideoTypeMeta = {
  type: string;
  label: string;
  accent: AccentKey;
  glyph: string;
  blurb: string;
};

const TYPE_META: VideoTypeMeta[] = [
  { type: "Trailer", label: "Trailers", accent: "gold", glyph: "▶", blurb: "The marquee" },
  { type: "Teaser", label: "Teasers", accent: "blue", glyph: "◐", blurb: "First glimpse" },
  { type: "Clip", label: "Clips", accent: "rose", glyph: "◆", blurb: "Excerpted scenes" },
  { type: "Featurette", label: "Featurettes", accent: "violet", glyph: "◉", blurb: "Inside the work" },
  { type: "Behind the Scenes", label: "Behind the Scenes", accent: "teal", glyph: "◇", blurb: "On set" },
];

const FALLBACK_META: VideoTypeMeta = {
  type: "More",
  label: "More",
  accent: "ember",
  glyph: "·",
  blurb: "Other footage",
};

function metaFor(type: string): VideoTypeMeta {
  return TYPE_META.find((m) => m.type === type) ?? FALLBACK_META;
}

// YouTube exposes predictable thumbnail URLs — no API call.
function youtubeThumb(key: string): string {
  return `https://img.youtube.com/vi/${key}/mqdefault.jpg`;
}

export default function FilmVideos({ videos }: FilmVideosProps) {
  const groups = useMemo(() => {
    const known = new Map<string, MovieVideo[]>();
    const other: MovieVideo[] = [];
    for (const v of videos) {
      if (TYPE_META.some((m) => m.type === v.type)) {
        const arr = known.get(v.type) ?? [];
        arr.push(v);
        known.set(v.type, arr);
      } else {
        other.push(v);
      }
    }
    return { known, other };
  }, [videos]);

  const trailers = groups.known.get("Trailer") ?? [];

  const supporting = useMemo(() => {
    const out: { meta: VideoTypeMeta; items: MovieVideo[] }[] = [];
    for (const meta of TYPE_META) {
      if (meta.type === "Trailer") continue;
      const items = groups.known.get(meta.type);
      if (items?.length) out.push({ meta, items });
    }
    if (groups.other.length) out.push({ meta: FALLBACK_META, items: groups.other });
    return out;
  }, [groups]);

  const initialKey = videos[0]?.key ?? null;
  const [activeKey, setActiveKey] = useState<string | null>(initialKey);
  const [activeTab, setActiveTab] = useState<string | null>(
    supporting[0]?.meta.type ?? null,
  );

  if (videos.length === 0 || activeKey === null) {
    return (
      <div
        style={{
          width: "100%",
          aspectRatio: "16/9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "14px",
          background: "var(--surface2)",
          border: "1px solid var(--border)",
          color: "var(--t3)",
        }}
      >
        No videos available
      </div>
    );
  }

  const active = videos.find((v) => v.key === activeKey) ?? videos[0];
  const activeMeta = metaFor(active.type);
  const visibleSupporting = supporting.find((g) => g.meta.type === activeTab);

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          paddingBottom: "56.25%",
          borderRadius: "14px",
          overflow: "hidden",
          background: "var(--surface2)",
          border: `1px solid rgba(var(--${activeMeta.accent}-rgb), 0.35)`,
          boxShadow: `0 12px 36px rgba(var(--${activeMeta.accent}-rgb), 0.12)`,
          marginBottom: "8px",
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        <iframe
          key={active.key}
          src={`https://www.youtube-nocookie.com/embed/${active.key}`}
          title={active.name}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: 0,
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "24px",
          fontSize: "12px",
          color: "var(--t2)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "5px",
            padding: "3px 8px",
            borderRadius: "4px",
            background: `var(--${activeMeta.accent}-soft)`,
            border: `1px solid var(--${activeMeta.accent}-border)`,
            color: `var(--${activeMeta.accent})`,
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "1.4px",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          <span aria-hidden style={{ fontSize: "9px" }}>
            {activeMeta.glyph}
          </span>
          {activeMeta.type}
        </span>
        <span
          className="font-serif"
          style={{
            fontSize: "13px",
            fontStyle: "italic",
            color: "var(--t1)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {active.name}
        </span>
      </div>

      {trailers.length > 0 && (
        <TrailerRail
          videos={trailers}
          activeKey={activeKey}
          onSelect={setActiveKey}
        />
      )}

      {supporting.length > 0 && (
        <SupportingSection
          groups={supporting}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          visible={visibleSupporting}
          activeKey={activeKey}
          onSelect={setActiveKey}
        />
      )}
    </div>
  );
}

function TrailerRail({
  videos,
  activeKey,
  onSelect,
}: {
  videos: MovieVideo[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  const meta = metaFor("Trailer");
  return (
    <section style={{ marginBottom: "30px", minWidth: 0 }}>
      <GroupHeader meta={meta} count={videos.length} />
      <ScrollRail>
        {videos.map((v) => (
          <VideoCard
            key={v.key}
            video={v}
            meta={meta}
            isActive={v.key === activeKey}
            onSelect={onSelect}
            size="large"
          />
        ))}
      </ScrollRail>
    </section>
  );
}

function SupportingSection({
  groups,
  activeTab,
  onTabChange,
  visible,
  activeKey,
  onSelect,
}: {
  groups: { meta: VideoTypeMeta; items: MovieVideo[] }[];
  activeTab: string | null;
  onTabChange: (type: string) => void;
  visible: { meta: VideoTypeMeta; items: MovieVideo[] } | undefined;
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  if (groups.length === 1) {
    const only = groups[0];
    return (
      <section style={{ minWidth: 0 }}>
        <GroupHeader meta={only.meta} count={only.items.length} />
        <ScrollRail>
          {only.items.map((v) => (
            <VideoCard
              key={v.key}
              video={v}
              meta={only.meta}
              isActive={v.key === activeKey}
              onSelect={onSelect}
              size="small"
            />
          ))}
        </ScrollRail>
      </section>
    );
  }

  return (
    <section style={{ minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <h3
          className="font-serif"
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--t1)",
            margin: 0,
            letterSpacing: "-0.2px",
          }}
        >
          More from this film
        </h3>
        <span
          aria-hidden
          style={{
            flex: 1,
            height: "1px",
            background:
              "linear-gradient(to right, var(--border) 0%, transparent 100%)",
          }}
        />
      </div>

      <div
        role="tablist"
        aria-label="Video type"
        style={{
          display: "flex",
          gap: "6px",
          flexWrap: "wrap",
          marginBottom: "14px",
        }}
      >
        {groups.map((g) => {
          const isActive = activeTab === g.meta.type;
          return (
            <button
              key={g.meta.type}
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(g.meta.type)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "100px",
                fontSize: "12px",
                fontWeight: 600,
                background: isActive
                  ? `var(--${g.meta.accent}-soft)`
                  : "var(--tag-bg)",
                border: `1px solid ${
                  isActive
                    ? `var(--${g.meta.accent}-border)`
                    : "var(--tag-border)"
                }`,
                color: isActive ? `var(--${g.meta.accent})` : "var(--t1)",
                cursor: "pointer",
                transition: "background 0.18s ease, border-color 0.18s ease, color 0.18s ease",
              }}
            >
              <span aria-hidden style={{ fontSize: "10px" }}>
                {g.meta.glyph}
              </span>
              {g.meta.label}
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 700,
                  letterSpacing: "1px",
                  opacity: 0.78,
                }}
              >
                {String(g.items.length).padStart(2, "0")}
              </span>
            </button>
          );
        })}
      </div>

      {visible && (
        <div key={visible.meta.type} style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: "11px",
              fontStyle: "italic",
              color: "var(--t3)",
              marginBottom: "10px",
              letterSpacing: "0.2px",
            }}
          >
            {visible.meta.blurb}
          </div>
          <ScrollRail>
            {visible.items.map((v) => (
              <VideoCard
                key={v.key}
                video={v}
                meta={visible.meta}
                isActive={v.key === activeKey}
                onSelect={onSelect}
                size="small"
              />
            ))}
          </ScrollRail>
        </div>
      )}
    </section>
  );
}

function GroupHeader({
  meta,
  count,
}: {
  meta: VideoTypeMeta;
  count: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: "12px",
        marginBottom: "12px",
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: "11px",
          lineHeight: 1,
          color: `var(--${meta.accent})`,
          flexShrink: 0,
        }}
      >
        {meta.glyph}
      </span>
      <h3
        className="font-serif"
        style={{
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--t1)",
          margin: 0,
          letterSpacing: "-0.2px",
        }}
      >
        {meta.label}
      </h3>
      <span
        style={{
          fontSize: "10px",
          fontWeight: 700,
          color: "var(--t3)",
          letterSpacing: "1px",
        }}
      >
        {String(count).padStart(2, "0")}
      </span>
      <span
        aria-hidden
        style={{
          flex: 1,
          height: "1px",
          background: `linear-gradient(to right, rgba(var(--${meta.accent}-rgb), 0.35), transparent)`,
        }}
      />
      <span
        style={{
          fontSize: "10px",
          fontStyle: "italic",
          color: "var(--t3)",
          letterSpacing: "0.3px",
        }}
      >
        {meta.blurb}
      </span>
    </div>
  );
}

function ScrollRail({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "10px",
        overflowX: "auto",
        paddingBottom: "6px",
        minWidth: 0,
        maxWidth: "100%",
        scrollbarWidth: "thin",
        scrollbarColor: "var(--border) transparent",
      }}
    >
      {children}
    </div>
  );
}

function VideoCard({
  video,
  meta,
  isActive,
  onSelect,
  size,
}: {
  video: MovieVideo;
  meta: VideoTypeMeta;
  isActive: boolean;
  onSelect: (key: string) => void;
  size: "large" | "small";
}) {
  const width = size === "large" ? 240 : 168;

  return (
    <button
      onClick={() => onSelect(video.key)}
      aria-pressed={isActive}
      title={video.name}
      style={{
        flexShrink: 0,
        width: `${width}px`,
        padding: 0,
        background: "transparent",
        border: 0,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "16/9",
          borderRadius: "8px",
          overflow: "hidden",
          background: "var(--surface2)",
          border: `1px solid ${
            isActive ? `var(--${meta.accent}-border)` : "var(--border)"
          }`,
          boxShadow: isActive
            ? `0 6px 22px rgba(var(--${meta.accent}-rgb), 0.28)`
            : "0 2px 8px rgba(0,0,0,0.12)",
          transform: isActive ? "translateY(-2px)" : "none",
          transition:
            "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={youtubeThumb(video.key)}
          alt={video.name}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            opacity: isActive ? 1 : 0.92,
            filter: isActive ? "none" : "saturate(0.92)",
            transition: "opacity 0.18s ease, filter 0.18s ease",
          }}
        />

        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: isActive
              ? `linear-gradient(180deg, transparent 40%, rgba(var(--${meta.accent}-rgb), 0.18) 100%)`
              : "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45) 100%)",
            transition: "background 0.2s ease",
          }}
        >
          <span
            style={{
              width: size === "large" ? "44px" : "36px",
              height: size === "large" ? "44px" : "36px",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isActive
                ? `var(--${meta.accent})`
                : "rgba(255,255,255,0.92)",
              color: isActive ? "var(--accent-ink)" : "rgb(20,16,28)",
              fontSize: size === "large" ? "15px" : "12px",
              paddingLeft: "3px",
              boxShadow: "0 4px 14px rgba(0,0,0,0.4)",
              transition: "background 0.2s ease, color 0.2s ease",
            }}
          >
            ▶
          </span>
        </span>

        {isActive && (
          <span
            style={{
              position: "absolute",
              bottom: "6px",
              right: "6px",
              padding: "2px 6px",
              borderRadius: "3px",
              background: `var(--${meta.accent})`,
              color: "var(--accent-ink)",
              fontSize: "8.5px",
              fontWeight: 800,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              lineHeight: 1,
            }}
          >
            Now playing
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: "6px",
          fontSize: size === "large" ? "12.5px" : "11.5px",
          fontWeight: isActive ? 600 : 500,
          color: isActive ? "var(--t1)" : "var(--t2)",
          lineHeight: 1.35,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          transition: "color 0.18s ease",
        }}
      >
        {video.name}
      </div>
    </button>
  );
}
