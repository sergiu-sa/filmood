"use client";

import { useEffect, useId, useRef, useState } from "react";
import { getAuthHeaders } from "@/lib/getAuthToken";

interface Waiting {
  id: string;
  nickname: string;
}

interface CarryOnProps {
  code: string;
  /** The route the host moves on from: the mood page builds the deck, the swipe page finishes. */
  phase: "mood" | "swipe";
  /**
   * Who the host would leave out. Empty only on the mood page: a seat deleted with its account leaves
   * everyone else locked in, and no lock-in is coming to build the deck.
   */
  waitingOn: Waiting[];
  /** Reads the session again once the server has moved it on. */
  onDone: () => void;
  /** The deck would be too thin and the route has cleared the host's picks: the picker comes back with this. */
  onPickAgain?: (message: string) => void;
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
export default function CarryOn({ code, phase, waitingOn, onDone, onPickAgain }: CarryOnProps) {
  /** The names the open confirm shows, kept while polls change the list under it. */
  const [confirming, setConfirming] = useState<Waiting[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const textId = useId();

  const copy = COPY[phase];
  const shown = confirming ?? waitingOn;
  const count = shown.length;
  const label =
    count === 0
      ? "Start swiping"
      : `${copy.verb} without ${count === 1 ? shown[0].nickname : `the ${count} still ${copy.still}`}`;
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(shown.map((p) => p.nickname));
  const warning = `${names} ${count === 1 ? "hasn't" : "haven't"} ${copy.warning}`;

  // Keep waiting, or a refusal, unmounts the confirm, so focus goes back to the button that opened it.
  useEffect(() => {
    const open = confirming !== null;
    if (!open && wasOpenRef.current) triggerRef.current?.focus();
    wasOpenRef.current = open;
  }, [confirming]);

  // The ids sent are the ones the host saw: the route refuses to remove anyone else.
  const run = async (leftOut: Waiting[]) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/group/${code}/${phase}`, {
        method: "PATCH",
        headers: await getAuthHeaders(),
        body: JSON.stringify({ participantIds: leftOut.map((p) => p.id) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 422 && onPickAgain) {
          onPickAgain(data.error);
          return;
        }
        setConfirming(null);
        setError(data.error || "Something went wrong");
        return;
      }
      onDone();
    } catch {
      setConfirming(null);
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
              onClick={() => run(confirming)}
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
              onClick={() => setConfirming(null)}
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
          onClick={() => (count === 0 ? run([]) : setConfirming(waitingOn))}
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
