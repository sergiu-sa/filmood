"use client";

import Link from "next/link";
import Icon from "@/components/ui/Icon";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * Breadcrumb renders a trail: Home / Section / Current.
 * The last item is the current page. All preceding items are links.
 */
export default function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0",
        fontSize: "14px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        padding: "6px 4px",
        borderRadius: "8px",
      }}
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const isHome = i === 0 && item.href === "/";

        return (
          <span
            key={i}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0",
            }}
          >
            {/* Chevron separator */}
            {i > 0 && (
              <span
                style={{
                  color: "var(--t2)",
                  flexShrink: 0,
                  margin: "0 3px",
                  display: "flex",
                }}
              >
                <Icon name="chevron-right" size={16} />
              </span>
            )}

            {isLast || !item.href ? (
              /* Current page — no link */
              <span
                style={{
                  color: "var(--t1)",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  background: "var(--tag-bg)",
                  border: "1px solid var(--tag-border)",
                  maxWidth: "260px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {item.label}
              </span>
            ) : (
              /* Clickable link */
              <Link
                href={item.href}
                className="crumb-link"
                style={{
                  color: "var(--t1)",
                  textDecoration: "none",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                {/* Home icon for the first "/" link */}
                {isHome && (
                  <span
                    style={{ flexShrink: 0, marginTop: "-1px", display: "flex" }}
                  >
                    <Icon name="home" size={14} />
                  </span>
                )}
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
