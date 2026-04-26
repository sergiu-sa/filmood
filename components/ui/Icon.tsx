/**
 * App-wide editorial icon set. Same minimal-stroke style as
 * `lib/browseCategories.tsx` (currentColor, 1.5 stroke, generic 24×24
 * viewBox) so callers pick their own size and color.
 *
 * Used by profile, auth pages, and (post-consolidation pass — see
 * docs/NOTES.md Session 9 follow-ups) the rest of the app's chrome.
 *
 * NOT for: the brand mark (see `components/dashboard/FilmoodLogo.tsx`)
 * or the six browse-category icons paired with their data in
 * `lib/browseCategories.tsx`. Those have their own homes for good reason.
 */

export type IconName =
  | "calendar"
  | "mark"
  | "pencil"
  | "user"
  | "mail"
  | "lock"
  | "check"
  | "close"
  | "logout"
  | "trash"
  | "signal"
  | "play"
  | "share"
  | "eye"
  | "eye-off";

interface IconProps {
  name: IconName;
  size?: number;
  /** Fill icons (e.g. mark) get fill: currentColor; outline icons get stroke. */
  className?: string;
}

export default function Icon({ name, size = 16, className }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    className,
    "aria-hidden": true,
    focusable: false as const,
  };

  switch (name) {
    case "calendar":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      );
    case "mark":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M12 2 L13.5 9.5 L21 12 L13.5 14.5 L12 22 L10.5 14.5 L3 12 L10.5 9.5 Z" />
        </svg>
      );
    case "pencil":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3 L21 7 L8 20 L3 21 L4 16 L17 3 Z" />
        </svg>
      );
    case "user":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21 c0-4.5 3.5-8 8-8 s8 3.5 8 8" />
        </svg>
      );
    case "mail":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7 L12 13 L21 7" />
        </svg>
      );
    case "lock":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="11" width="16" height="10" rx="2" />
          <path d="M8 11 V7 a4 4 0 0 1 8 0 V11" />
        </svg>
      );
    case "check":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="4 12 10 18 20 6" />
        </svg>
      );
    case "close":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      );
    case "logout":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 4 H5 a2 2 0 0 0-2 2 v12 a2 2 0 0 0 2 2 h4" />
          <path d="M16 17 l5-5-5-5" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
    case "trash":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 21 6" />
          <path d="M19 6 L18 20 a2 2 0 0 1-2 2 H8 a2 2 0 0 1-2-2 L5 6" />
          <path d="M10 11 V17 M14 11 V17" />
          <path d="M9 6 V4 a1 1 0 0 1 1-1 h4 a1 1 0 0 1 1 1 V6" />
        </svg>
      );
    case "signal":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12 a14 14 0 0 1 20 0" />
          <path d="M5 15 a10 10 0 0 1 14 0" />
          <path d="M8.5 18 a6 6 0 0 1 7 0" />
          <circle cx="12" cy="20.5" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      );
    case "play":
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <path d="M7 4 L20 12 L7 20 Z" />
        </svg>
      );
    case "share":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16 V3 M7 8 L12 3 L17 8" />
          <path d="M5 12 V19 a2 2 0 0 0 2 2 h10 a2 2 0 0 0 2-2 V12" />
        </svg>
      );
    case "eye":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 12 s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7 z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case "eye-off":
      return (
        <svg
          {...common}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3 L21 21" />
          <path d="M10.6 6.1 a10.5 10.5 0 0 1 1.4-.1 c6.5 0 10 7 10 7 a18.5 18.5 0 0 1-3.2 4" />
          <path d="M6.6 6.6 C3.8 8.4 2 12 2 12 s3.5 7 10 7 a10.5 10.5 0 0 0 4.4-.9" />
          <path d="M9.9 9.9 a3 3 0 0 0 4.2 4.2" />
        </svg>
      );
  }
}
