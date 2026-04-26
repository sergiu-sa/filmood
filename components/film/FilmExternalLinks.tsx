import type { ExternalIds } from "@/lib/types";

interface FilmExternalLinksProps {
  externalIds: ExternalIds | null;
}

interface LinkConfig {
  href: string;
  label: string;
  primary: boolean;
}

function buildLinks(ids: ExternalIds): LinkConfig[] {
  const links: LinkConfig[] = [];
  if (ids.imdb_id) {
    links.push({
      href: `https://www.imdb.com/title/${ids.imdb_id}/`,
      label: "IMDb",
      primary: true,
    });
  }
  if (ids.facebook_id) {
    links.push({
      href: `https://www.facebook.com/${ids.facebook_id}`,
      label: "Facebook",
      primary: false,
    });
  }
  if (ids.instagram_id) {
    links.push({
      href: `https://www.instagram.com/${ids.instagram_id}/`,
      label: "Instagram",
      primary: false,
    });
  }
  if (ids.twitter_id) {
    links.push({
      href: `https://twitter.com/${ids.twitter_id}`,
      label: "Twitter / X",
      primary: false,
    });
  }
  return links;
}

/**
 * IMDb + social-media link buttons for the "External links" section.
 * IMDb gets the gold-accent primary treatment (it's the high-value
 * link for date research); the others use neutral tag styling.
 */
export default function FilmExternalLinks({
  externalIds,
}: FilmExternalLinksProps) {
  if (!externalIds) return null;
  const links = buildLinks(externalIds);
  if (links.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          style={
            link.primary
              ? {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "var(--gold-soft)",
                  border: "1px solid var(--gold-border)",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--gold)",
                  textDecoration: "none",
                }
              : {
                  padding: "8px 14px",
                  borderRadius: "8px",
                  background: "var(--tag-bg)",
                  border: "1px solid var(--tag-border)",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--t1)",
                  textDecoration: "none",
                }
          }
        >
          {link.label} ↗
        </a>
      ))}
    </div>
  );
}
