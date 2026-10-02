"use client";

import FilmCard from "@/components/film/FilmCard";
import { ACCENT_VARS } from "@/lib/constants";
import { filmCount } from "@/lib/filmCount";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { reasonGenres } from "@/lib/whyLine";
import type { DiscoverFilm, DiscoverResponse } from "@/lib/types";

interface ResultsGridProps {
  /** Without the top pick when there is one. */
  films: DiscoverFilm[];
  moods: DiscoverResponse["moods"];
}

/**
 * The results grid. One mood: "More matches". A blend: "Fits both moods" first,
 * then "From each mood", with a dot per source mood on each card and a legend.
 */
export default function ResultsGrid({ films, moods }: ResultsGridProps) {
  const isSmall = useMediaQuery("(max-width: 440px)");
  const isMedium = useMediaQuery("(max-width: 740px)");
  const isTablet = useMediaQuery("(max-width: 900px)");
  const isNarrowDesktop = useMediaQuery("(max-width: 1100px)");
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  if (films.length === 0) return null;

  // minmax(0, …): a plain 1fr column grows to fit a long nowrap title.
  const columns = `repeat(${isSmall ? 1 : isMedium ? 2 : isTablet ? 3 : isNarrowDesktop ? 4 : 5}, minmax(0, 1fr))`;

  const blend = moods.length > 1;
  const accentOf = (key: string) => {
    const mood = moods.find((m) => m.key === key);
    return ACCENT_VARS[mood?.accent ?? "gold"].base;
  };

  const grid = (list: DiscoverFilm[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: isTablet ? "12px" : "14px",
        width: "100%",
        ...(isSmall ? { maxWidth: "320px", margin: "0 auto" } : {}),
      }}
    >
      {list.map((film, i) => (
        <div
          key={film.id}
          style={
            // Inline, so globals.css's reduced-motion rules can't reach it.
            reduceMotion
              ? undefined
              : { animation: "fadeUp 0.4s ease both", animationDelay: `${Math.min(i * 40, 500)}ms` }
          }
        >
          <FilmCard
            id={film.id}
            title={film.title}
            posterPath={film.poster_path}
            releaseDate={film.release_date}
            voteAverage={film.vote_average}
            overview={film.overview}
            accentBase={accentOf(film.moodKeys[0])}
            reason={reasonGenres(film.genre_ids, film.moodKeys)}
            moodDots={
              blend
                ? moods
                    .filter((m) => film.moodKeys.includes(m.key))
                    .map((m) => ({ color: ACCENT_VARS[m.accent].base, label: m.label }))
                : undefined
            }
          />
        </div>
      ))}
    </div>
  );

  const legend = (
    <div className="font-sans" style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: "12px", color: "var(--t2)" }}>
      {moods.map((m) => (
        <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <span
            aria-hidden="true"
            style={{ width: "9px", height: "9px", borderRadius: "50%", background: ACCENT_VARS[m.accent].base }}
          />
          {m.label}
        </span>
      ))}
    </div>
  );

  if (!blend) {
    return (
      <section style={{ width: "100%" }}>
        <Heading title="More matches" note={filmCount(films.length)} />
        {grid(films)}
      </section>
    );
  }

  const both = films.filter((f) => moods.every((m) => f.moodKeys.includes(m.key)));
  const each = films.filter((f) => !both.includes(f));

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "30px" }}>
      {both.length > 0 && (
        <section>
          <Heading title="Fits both moods" note={filmCount(both.length)} legend={legend} />
          {grid(both)}
        </section>
      )}
      {each.length > 0 && (
        <section>
          <Heading
            title="From each mood"
            note={`${filmCount(each.length)}, alternating`}
            legend={both.length > 0 ? undefined : legend}
          />
          {grid(each)}
        </section>
      )}
    </div>
  );
}

function Heading({ title, note, legend }: { title: string; note: string; legend?: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "8px 24px",
        marginBottom: "18px",
      }}
    >
      <div className="font-sans" style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
        <h2
          style={{
            margin: 0,
            fontSize: "13px",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "1.5px",
            color: "var(--t1)",
          }}
        >
          {title}
        </h2>
        <span style={{ fontSize: "12px", color: "var(--t2)" }}>{note}</span>
      </div>
      {legend}
    </div>
  );
}
