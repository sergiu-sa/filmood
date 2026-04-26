interface Genre {
  id: number;
  name: string;
}

interface FilmDetailsTableProps {
  runtime: number | null;
  year: string | undefined;
  genres: Genre[];
}

/**
 * Key-value summary at the bottom of the film detail page (Runtime,
 * Release year, Genres). Rows with empty values are skipped.
 */
export default function FilmDetailsTable({
  runtime,
  year,
  genres,
}: FilmDetailsTableProps) {
  const rows: { label: string; value: string | undefined }[] = [
    {
      label: "Runtime",
      value: runtime ? `${runtime} minutes` : undefined,
    },
    { label: "Release year", value: year },
    {
      label: "Genres",
      value: genres?.map((g) => g.name).join(", "),
    },
  ];

  return (
    <>
      {rows
        .filter((r) => r.value)
        .map((row) => (
          <div
            key={row.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--t2)",
                transition: "color 0.2s",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "var(--t1)",
                textAlign: "right",
                maxWidth: "60%",
                transition: "color 0.2s",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
    </>
  );
}
