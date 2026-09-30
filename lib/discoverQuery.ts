// The results page's discover request. Pure.

import { isWhereKey } from "@/lib/moodFilters";
import { parseSeed } from "@/lib/seededRandom";

// Fixed order, so the same URL in any order is the same request.
const FORWARDED = ["mood", "time", "era", "where", "services", "tempo", "runtime", "text"] as const;

/**
 * The discover request for a results URL, without `src`. Null until the URL has a
 * mood or text and a seed. Every param the API reads is here, so the page's
 * once-per-query guard can't miss one.
 */
export function discoverQuery(sp: URLSearchParams, deviceServices: readonly string[]): string | null {
  const seed = parseSeed(sp.get("seed"));
  if (!seed || !(sp.get("mood") || sp.get("text"))) return null;

  const where = sp.get("where");
  const out = new URLSearchParams();
  for (const key of FORWARDED) {
    // No Where (or one the route doesn't know) means "my default" (Q1), so this device's services go with it.
    const value =
      key === "services" && !sp.get("services") && (where === "mine" || !isWhereKey(where))
        ? deviceServices.join(",")
        : sp.get(key);
    if (value) out.set(key, value);
  }
  out.set("seed", String(seed));
  return out.toString();
}
