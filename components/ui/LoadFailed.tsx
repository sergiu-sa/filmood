import Icon from "@/components/ui/Icon";
import type { LoadError } from "@/lib/useFilms";

/** A film list that failed to load: the message, and Try again when a retry can help. */
export default function LoadFailed({ error, onRetry }: { error: LoadError; onRetry: () => void }) {
  return (
    <div role="alert" style={{ textAlign: "center", padding: "48px 20px" }}>
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "14px",
          background: "var(--blue-soft)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
        }}
      >
        <span style={{ color: "var(--blue)", opacity: 0.7, display: "flex" }}>
          <Icon name="search" size={24} />
        </span>
      </div>
      <p style={{ fontSize: "14px", fontWeight: 500, color: "var(--t2)", margin: "0 0 14px" }}>
        {error.message}
      </p>
      {error.retryable && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: "44px",
            boxSizing: "border-box",
            padding: "0 20px",
            borderRadius: "10px",
            border: "none",
            background: "var(--blue)",
            color: "var(--blue-on)",
            fontFamily: "inherit",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
