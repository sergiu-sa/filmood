import type { SupabaseClient } from "@supabase/supabase-js";
import { createMockSupabase } from "@/lib/__tests__/helpers/supabase-mock";
import { EMPTY_FILTERS } from "@/lib/moodFilters";

type ProviderRow = { provider_id: number; provider_name: string };

// TMDB's /watch/providers/movie?watch_region=NO, trimmed to what matters.
const NORWAY: ProviderRow[] = [
  // Listed first so a prefix match would take it: Netflix Kids is not Netflix.
  { provider_id: 175, provider_name: "Netflix Kids" },
  { provider_id: 8, provider_name: "Netflix" },
  { provider_id: 76, provider_name: "Viaplay" },
  { provider_id: 1899, provider_name: "HBO Max" },
  { provider_id: 431, provider_name: "TV 2 Play" },
  { provider_id: 337, provider_name: "Disney Plus" },
  { provider_id: 119, provider_name: "Amazon Prime Video" },
];

const without = (name: string) => NORWAY.filter((p) => p.provider_name !== name);

async function load(providers: ProviderRow[] = NORWAY) {
  const tmdbJson = vi.fn(async () => ({ results: providers }));
  vi.doMock("@/lib/tmdb-fetch", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/lib/tmdb-fetch")>()),
    tmdbJson,
  }));
  return { ...(await import("@/lib/watchProviders")), tmdbJson };
}

const savedRow = (platforms: string[] | null, error: unknown = null) => {
  const supabase = createMockSupabase([{ data: platforms ? { platforms } : null, error }]);
  return { supabase, saved: { supabase: supabase as unknown as SupabaseClient, userId: "user-1" } };
};

const MINE = { ...EMPTY_FILTERS, where: "mine" as const };

describe("norwayProviderIds", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("maps every platform to its Norway provider id by name", async () => {
    const { norwayProviderIds } = await load();
    expect(Object.fromEntries(await norwayProviderIds())).toEqual({
      netflix: 8,
      viaplay: 76,
      "hbo-max": 1899,
      "tv2-play": 431,
      "disney-plus": 337,
      "prime-video": 119,
    });
  });

  it("matches the old name Max and ignores case", async () => {
    const renamed = NORWAY.map((p) =>
      p.provider_id === 1899 ? { ...p, provider_name: "Max" } : { ...p, provider_name: p.provider_name.toUpperCase() },
    );
    const { norwayProviderIds } = await load(renamed);
    const ids = await norwayProviderIds();
    expect(ids.get("hbo-max")).toBe(1899);
    expect(ids.get("netflix")).toBe(8);
  });

  it("asks TMDB for Norway's movie providers, cached for a day", async () => {
    const { norwayProviderIds, tmdbJson } = await load();
    await norwayProviderIds();
    expect(tmdbJson).toHaveBeenCalledWith(
      "/watch/providers/movie",
      { watch_region: "NO", language: "en-US" },
      86400,
    );
  });

  it("leaves out a platform TMDB doesn't list, and logs it once", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { norwayProviderIds } = await load(without("TV 2 Play"));

    const ids = await norwayProviderIds();
    await norwayProviderIds();

    expect(ids.has("tv2-play")).toBe(false);
    expect(ids.size).toBe(5);
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0])).toMatch(/TV 2 Play/);
  });
});

describe("resolveWhere", () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("uses a signed-in user's saved services over the param", async () => {
    const { resolveWhere } = await load();
    const { saved } = savedRow(["Netflix"]);
    expect(await resolveWhere(MINE, "viaplay", saved)).toEqual({ ...MINE, providers: [8] });
  });

  it("falls back to the param when a signed-in user has none saved", async () => {
    const { resolveWhere } = await load();
    expect(await resolveWhere(MINE, "viaplay", savedRow(null).saved)).toEqual({ ...MINE, providers: [76] });
    expect(await resolveWhere(MINE, "viaplay", savedRow(["Hulu"]).saved)).toEqual({ ...MINE, providers: [76] });
  });

  it("reads a guest's services from the param", async () => {
    const { resolveWhere } = await load();
    expect(await resolveWhere(MINE, "netflix,viaplay", null)).toEqual({ ...MINE, providers: [8, 76] });
  });

  it("settles on Norway for a guest with no services, without asking TMDB", async () => {
    const { resolveWhere, tmdbJson } = await load();
    const norway = { ...MINE, where: "norway", providers: [] };
    expect(await resolveWhere(MINE, null, null)).toEqual(norway);
    expect(await resolveWhere(MINE, "hulu,constructor", null)).toEqual(norway);
    expect(tmdbJson).not.toHaveBeenCalled();
  });

  it("settles on Norway when TMDB lists none of the chosen platforms", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { resolveWhere } = await load(without("TV 2 Play"));
    expect(await resolveWhere(MINE, "tv2-play", null)).toEqual({ ...MINE, where: "norway", providers: [] });
  });

  it.each(["norway", "any"] as const)("returns where=%s as is, with no calls", async (where) => {
    const { resolveWhere, tmdbJson } = await load();
    const { supabase, saved } = savedRow(["Netflix"]);
    const f = { ...EMPTY_FILTERS, where };

    expect(await resolveWhere(f, "netflix", saved)).toBe(f);
    expect(tmdbJson).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  // A 404 here is TMDB dropping the endpoint, our outage, so it must not reach
  // tmdbError as the client's "no such film".
  it("rejects a provider-list 404 as a plain error", async () => {
    const { resolveWhere, tmdbJson } = await load();
    const { TMDBError } = await import("@/lib/tmdb-fetch");
    tmdbJson.mockRejectedValueOnce(new TMDBError(404, "/watch/providers/movie"));

    const err = await resolveWhere(MINE, "netflix", null).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(TMDBError);
  });

  it("rejects on a database error", async () => {
    const { resolveWhere } = await load();
    const { saved } = savedRow(null, { message: "permission denied" });
    await expect(resolveWhere(MINE, "viaplay", saved)).rejects.toMatchObject({ message: "permission denied" });
  });
});

describe("savedServices", () => {
  afterEach(() => {
    vi.resetModules();
  });

  it("reads the user's row and maps stored names to slugs", async () => {
    const { savedServices } = await load();
    const { supabase, saved } = savedRow(["Prime Video", "Netflix", "Hulu"]);

    expect(await savedServices(saved.supabase, "user-1")).toEqual(["netflix", "prime-video"]);
    expect(supabase.from).toHaveBeenCalledWith("streaming_preferences");
    const chain = supabase.from.mock.results[0].value;
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

describe("groupProviders", () => {
  afterEach(() => {
    vi.resetModules();
  });

  const rows = (data: unknown, error: unknown = null) => {
    const supabase = createMockSupabase([{ data, error }]);
    return { supabase, client: supabase as unknown as SupabaseClient };
  };

  // "What at least one of us can stream": any member's service counts, once.
  it("unions every user's saved services into Norway provider ids, in PLATFORMS order", async () => {
    const { groupProviders } = await load();
    const { supabase, client } = rows([{ platforms: ["Viaplay", "Netflix"] }, { platforms: ["Netflix", "Hulu"] }]);

    expect(await groupProviders(client, ["u1", "u2"])).toEqual([8, 76]);
    expect(supabase.from).toHaveBeenCalledWith("streaming_preferences");
    expect(supabase.from.mock.results[0].value.in).toHaveBeenCalledWith("user_id", ["u1", "u2"]);
  });

  it("asks nothing when no participant is signed in", async () => {
    const { groupProviders, tmdbJson } = await load();
    const { supabase, client } = rows([]);
    expect(await groupProviders(client, [])).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(tmdbJson).not.toHaveBeenCalled();
  });

  it("returns none, without asking TMDB, when nobody saved a service", async () => {
    const { groupProviders, tmdbJson } = await load();
    expect(await groupProviders(rows([]).client, ["u1"])).toEqual([]);
    expect(await groupProviders(rows([{ platforms: ["Hulu"] }]).client, ["u1"])).toEqual([]);
    expect(tmdbJson).not.toHaveBeenCalled();
  });

  it("rejects on a database error", async () => {
    const { groupProviders } = await load();
    await expect(groupProviders(rows(null, { message: "permission denied" }).client, ["u1"])).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});
