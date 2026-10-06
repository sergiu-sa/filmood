"use client";

import { useEffect, useState } from "react";

/**
 * Debounces a value — returns the input only after `ms` milliseconds have
 * passed without further changes, in place of an inline
 * `useEffect + setTimeout(..., n)`.
 *
 * Usage:
 *   const debounced = useDebouncedValue(query, 400);
 *   useEffect(() => { fetch(...); }, [debounced]);
 */
export function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);

  return debounced;
}
