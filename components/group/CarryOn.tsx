"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getAuthHeaders } from "@/lib/getAuthToken";

interface CarryOnProps {
  code: string;
  /** The route the host moves on from: the mood page builds the deck, the swipe page finishes. */
  phase: "mood" | "swipe";
  /**
   * Who the host would leave out. Empty only on the mood page: a seat deleted with its account leaves
   * everyone else locked in, and no lock-in is coming to build the deck.
   */
  waitingOn: string[];
  /** Reads the session again once the server has moved it on. */
  onDone: () => void;
}

const COPY = {
  mood: { verb: "Start", still: "choosing", warning: "locked in. Starting now removes them from the session." },
  swipe: { verb: "Finish", still: "swiping", warning: "finished. Finishing now removes them and their votes so far." },
};

const secondary = {
  padding: "10px 22px",
  borderRadius: "var(--r)",
  background: "none",
  color: "var(--t2)",
  fontSize: "13px",
  fontWeight: 500,
  border: "1px solid var(--border)",
} as const;

/** The host's way past players who stopped: they are removed and the session moves on without them. */
export default function CarryOn({ code, phase, waitingOn, onDone }: CarryOnProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const confirmedRef = useRef(false);
  const textId = useId();

  const copy = COPY[phase];
  const count = waitingOn.length;
  const label =
    count === 0
      ? "Start swiping"
      : `${copy.verb} without ${count === 1 ? waitingOn[0] : `the ${count} still ${copy.still}`}`;
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(waitingOn);
  const warning = `${names} ${count === 1 ? "hasn't" : "haven't"} ${copy.warning}`;

  // Keep waiting unmounts the confirm, so focus goes back to the button that opened it.
  useEffect(() => {
    if (!confirming && confirmedRef.current) triggerRef.current?.focus();
    confirmedRef.current = confirming;
  }, [confirming]);

  const run = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/group/${code}/${phase}`, { method: "PATCH", headers: await getAuthHeaders() });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Something went wrong");
        return;
      }
      onDone();
    } catch {
      setError("Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2 font-sans" style={{ width: "100%", maxWidth: "280px" }}>
      {confirming ? (
        <>
          <p id={textId} style={{ margin: 0, fontSize: "13px", color: "var(--t2)", textAlign: "center" }}>
            {warning}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={run}
              aria-describedby={textId}
              aria-disabled={busy}
              className="cursor-pointer"
              style={{
                padding: "10px 22px",
                borderRadius: "var(--r)",
                background: "var(--gold)",
                color: "var(--gold-on)",
                fontSize: "13px",
                fontWeight: 700,
                border: "none",
              }}
            >
              {label}
            </button>
            {/* The safe choice takes focus, as the other one removes people. */}
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              aria-describedby={textId}
              className="cursor-pointer"
              style={secondary}
            >
              Keep waiting
            </button>
          </div>
        </>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (count === 0 ? run() : setConfirming(true))}
          aria-disabled={busy}
          className="cursor-pointer"
          style={secondary}
        >
          {label}
        </button>
      )}
      {error && (
        <p role="alert" style={{ margin: 0, fontSize: "13px", color: "var(--t1)", textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}
