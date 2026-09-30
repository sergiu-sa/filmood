// Where → "My services": which TMDB providers a search is limited to.
// Server-only: it calls TMDB through lib/tmdb-fetch and reads Supabase.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Filters } from "@/lib/moodFilters";
import { parseServices, PLATFORMS, slugsFromNames, type PlatformSlug } from "@/lib/platforms";
import { tmdbJson } from "@/lib/tmdb-fetch";

const PROVIDER_LIST_REVALIDATE = 86400;

// Per server instance, so a platform TMDB drops doesn't log on every search.
const reported = new Set<PlatformSlug>();

/** TMDB's Norway provider id per platform, matched by name. A platform TMDB doesn't list is logged once and left out. */
export async function norwayProviderIds(): Promise<Map<PlatformSlug, number>> {
  const { results = [] } = await tmdbJson<{ results?: { provider_id: number; provider_name: string }[] }>(
    "/watch/providers/movie",
    { watch_region: "NO", language: "en-US" },
    PROVIDER_LIST_REVALIDATE,
  );
  const ids = new Map<PlatformSlug, number>();
  for (const platform of PLATFORMS) {
    const names = platform.tmdbNames.map((n) => n.toLowerCase());
    const match = results.find((r) => names.includes(r.provider_name.toLowerCase()));
    if (match) {
      ids.set(platform.slug, match.provider_id);
    } else if (!reported.has(platform.slug)) {
      reported.add(platform.slug);
      console.error(`TMDB lists no Norway provider named ${platform.tmdbNames.join(" or ")} (${platform.name})`);
    }
  }
  return ids;
}

/** A signed-in user's saved services. Throws on a database error. */
export async function savedServices(supabase: SupabaseClient, userId: string): Promise<PlatformSlug[]> {
  const { data, error } = await supabase
    .from("streaming_preferences")
    .select("platforms")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return slugsFromNames(data?.platforms ?? []);
}

/**
 * Settles `where=mine` (spec §8): saved services for a signed-in user, else the
 * `services` param, else Norway. Any other Where passes through with no calls.
 */
export async function resolveWhere(
  f: Filters,
  servicesParam: string | null,
  saved: { supabase: SupabaseClient; userId: string } | null,
): Promise<Filters> {
  if (f.where !== "mine") return f;
  let slugs = saved ? await savedServices(saved.supabase, saved.userId) : [];
  if (slugs.length === 0) slugs = parseServices(servicesParam);
  const ids = slugs.length > 0 ? await norwayProviderIds() : new Map<PlatformSlug, number>();
  const providers = slugs.flatMap((slug) => ids.get(slug) ?? []);
  // Reported as norway, so the response never claims services it didn't apply.
  return providers.length > 0 ? { ...f, providers } : { ...f, where: "norway", providers: [] };
}
