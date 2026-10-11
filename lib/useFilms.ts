"use client";

import { useEffect, useRef, useState } from "react";
import type { Film } from "@/lib/types";

export type LoadError = { message: string; retryable: boolean };

/** A 5xx or no answer is worth retrying; a 4xx is the route's own message, the same on a retry. */
export function loadError(status?: number, message?: string): LoadError {
  if (status === undefined || status >= 500) {
    return { message: "Couldn't reach the film database.", retryable: true };
  }
  return { message: message ?? "Couldn't load these films.", retryable: false };
}

type Answer = { key: string; films: Film[]; totalPages: number; error: LoadError | null };

/**
 * The films a list route (`/api/movies/search`, `/browse`) answers for `url`.
 * A new url or attempt cancels the request before it, so a late answer never
 * replaces a newer one. `null` fetches nothing and keeps the last answer, so
 * going back to that url shows it at once, without a refetch.
 */
export function useFilms(url: string | null, attempt = 0) {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const landed = useRef("");
  const key = `${attempt} ${url}`;

  useEffect(() => {
    if (url === null || landed.current === key) return;
    const ctrl = new AbortController();
    (async () => {
      let next: Answer;
      try {
        const res = await fetch(url, { signal: ctrl.signal });
        const data = await res.json().catch(() => ({}));
        next = res.ok
          ? { key, films: data.films ?? [], totalPages: data.totalPages ?? 1, error: null }
          : { key, films: [], totalPages: 1, error: loadError(res.status, data.error) };
      } catch {
        next = { key, films: [], totalPages: 1, error: loadError() };
      }
      if (ctrl.signal.aborted) return;
      landed.current = key;
      setAnswer(next);
    })();
    return () => ctrl.abort();
  }, [url, key]);

  const shown = answer && (url === null || answer.key === key) ? answer : null;
  return {
    loading: url !== null && shown === null,
    films: shown?.films ?? [],
    totalPages: shown?.totalPages ?? 1,
    error: shown?.error ?? null,
  };
}
