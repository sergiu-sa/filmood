import FilmActions from "@/components/film/FilmActions";

interface Genre {
  id: number;
  name: string;
}

interface FilmHeaderInfoProps {
  movieId: number;
  title: string;
  voteAverage: number;
  /** Year string already extracted from the release date. */
  year: string | undefined;
  runtime: number | null;
  genres: Genre[];
  posterPath: string | null;
}

/**
 * Title + rating + year + runtime + genre chips + watchlist/share actions.
 * Renders both the desktop and mobile variants — the parent's `<style>`
 * block (`.fd-desktop-header` / `.fd-mobile-header`) decides which one is
 * visible at the active breakpoint, so no JS-driven responsive logic
 * lands here.
 */
export default function FilmHeaderInfo({
  movieId,
  title,
  voteAverage,
  year,
  runtime,
  genres,
  posterPath,
}: FilmHeaderInfoProps) {
  return (
    <>
      {/* Desktop */}
      <div className="fd-desktop-header">
        <p
          role="presentation"
          className="font-serif"
          style={{
            fontSize: "clamp(22px, 5vw, 32px)",
            fontWeight: 600,
            color: "var(--t1)",
            lineHeight: 1.15,
            margin: "0 0 10px",
            transition: "color 0.2s",
          }}
        >
          {title}
        </p>
        <Meta voteAverage={voteAverage} year={year} runtime={runtime} />
        <GenreChips genres={genres} marginBottom="16px" />
        <FilmActions
          movieId={movieId}
          movieTitle={title}
          posterPath={posterPath}
          layout="row"
        />
      </div>

      {/* Mobile / tablet */}
      <div className="fd-mobile-header">
        <h1
          className="font-serif"
          style={{
            fontSize: "clamp(20px, 5vw, 28px)",
            fontWeight: 600,
            color: "var(--t1)",
            lineHeight: 1.15,
            margin: "0 0 10px",
            transition: "color 0.2s",
          }}
        >
          {title}
        </h1>
        <Meta voteAverage={voteAverage} year={year} runtime={runtime} />
        <GenreChips genres={genres} marginBottom="14px" />
        <FilmActions
          movieId={movieId}
          movieTitle={title}
          posterPath={posterPath}
          layout="column"
        />
      </div>
    </>
  );
}

function Meta({
  voteAverage,
  year,
  runtime,
}: {
  voteAverage: number;
  year: string | undefined;
  runtime: number | null;
}) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "12px",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          padding: "3px 8px",
          borderRadius: "6px",
          background: "var(--gold-soft)",
          border: "1px solid var(--gold-border)",
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--gold)",
        }}
      >
        ★ {voteAverage?.toFixed(1)}
      </span>
      {year && (
        <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--t1)" }}>
          {year}
        </span>
      )}
      {runtime && (
        <>
          <span style={{ fontSize: "10px", color: "var(--t2)" }}>·</span>
          <span
            style={{ fontSize: "13px", fontWeight: 500, color: "var(--t1)" }}
          >
            {runtime} min
          </span>
        </>
      )}
    </span>
  );
}

function GenreChips({
  genres,
  marginBottom,
}: {
  genres: Genre[];
  marginBottom: string;
}) {
  if (!genres || genres.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        marginBottom,
      }}
    >
      {genres.map((g) => (
        <span
          key={g.id}
          style={{
            padding: "5px 12px",
            borderRadius: "100px",
            fontSize: "12px",
            fontWeight: 600,
            background: "var(--tag-bg)",
            border: "1px solid var(--tag-border)",
            color: "var(--t1)",
          }}
        >
          {g.name}
        </span>
      ))}
    </div>
  );
}
