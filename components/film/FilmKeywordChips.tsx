import type { Keyword } from "@/lib/types";

interface FilmKeywordChipsProps {
  keywords: Keyword[];
}

/**
 * Theme/keyword chip strip ("Themes" section on the film detail page).
 * Same chip styling as the genre chips in the header so the two read as
 * the same family.
 */
export default function FilmKeywordChips({ keywords }: FilmKeywordChipsProps) {
  if (!keywords || keywords.length === 0) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
      }}
    >
      {keywords.map((k) => (
        <span
          key={k.id}
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
          {k.name}
        </span>
      ))}
    </div>
  );
}
