#!/usr/bin/env tsx
/**
 * Measures the mood engine against live TMDB. Run locally, not in CI.
 *
 *   npm run check:moods                      mood × refinement coverage table
 *   npm run check:moods -- --keywords        verify every TMDB_KEYWORDS id by name
 *   npm run check:moods -- --find "<name>"   keyword candidates, for curating new ones
 *   npm run check:moods -- --probe           verify how TMDB reads "," and "|"
 *
 * Exits 1 when a check fails. TMDB_API_KEY is loaded from .env.local.
 */
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { config as loadEnv } from "dotenv";
import { allMoods } from "@/lib/moodMap";
import { buildMoodParams } from "@/lib/moodQuery";
import {
  applyRefinements,
  EMPTY_REFINEMENTS,
  type Refinements,
} from "@/lib/moodFilters";
import { TMDB_KEYWORDS } from "@/lib/tmdbKeywords";
import { tmdbJson, tmdbJsonOptional } from "@/lib/tmdb-fetch";

loadEnv({ path: path.resolve(__dirname, "../.env.local") });

const MIN_RESULTS = 12;
// Plain Node ignores Next's cache options; any number keeps tmdbJson off its
// `cache: "no-store"` branch.
const REVALIDATE = 0;
const CALL_GAP_MS = 50;

interface DiscoverPage {
  total_results?: number;
  results?: { title: string; release_date?: string }[];
}

interface KeywordHit {
  id: number;
  name: string;
}

async function tmdb<T>(p: string, params: Record<string, string>): Promise<T> {
  await sleep(CALL_GAP_MS);
  return tmdbJson<T>(p, params, REVALIDATE);
}

const discover = (params: Record<string, string>) =>
  tmdb<DiscoverPage>("/discover/movie", { ...params, page: "1" });

// Built exactly as the discover route builds a single-mood query.
function moodQuery(key: string, r: Partial<Refinements>): Record<string, string> {
  const params: Record<string, string> = { language: "en-US", ...buildMoodParams(key) };
  applyRefinements(params, { ...EMPTY_REFINEMENTS, ...r });
  return params;
}

const COLUMNS: [string, Partial<Refinements>][] = [
  ["none", {}],
  ["classic", { era: "classic" }],
  ["modern", { era: "modern" }],
  ["fresh", { era: "fresh" }],
  ["slowburn", { tempo: "slowburn" }],
  ["fastpaced", { tempo: "fastpaced" }],
  ["short", { runtime: "short" }],
  ["long", { runtime: "long" }],
  ["en", { language: "en" }],
];

async function coverage(): Promise<boolean> {
  console.log(`| mood | ${COLUMNS.map(([name]) => name).join(" | ")} |`);
  console.log(`|---|${COLUMNS.map(() => "---:").join("|")}|`);
  const tops: string[] = [];
  const caps: string[] = [];
  let ok = true;

  for (const mood of allMoods) {
    const cells: string[] = [];
    for (const [name, r] of COLUMNS) {
      const page = await discover(moodQuery(mood.key, r));
      const n = page.total_results ?? 0;
      cells.push(n < MIN_RESULTS ? `**${n}**` : String(n));
      if (name !== "none") continue;
      if (n < MIN_RESULTS) ok = false;
      const cap = mood.certification;
      if (cap) caps.push(`- ${mood.key}: ${n} films at ${cap.country} ≤ ${cap.lte}`);
      const titles = (page.results ?? [])
        .slice(0, 3)
        .map((f) => `${f.title} (${f.release_date?.slice(0, 4) || "?"})`);
      tops.push(`- ${mood.key}: ${titles.join(" · ") || "—"}`);
    }
    console.log(`| ${mood.key} | ${cells.join(" | ")} |`);
  }

  console.log(`\nTop 3, no refinements:\n${tops.join("\n")}`);
  if (caps.length) console.log(`\nCertification caps (in every query):\n${caps.join("\n")}`);
  if (!ok) console.log(`\nFAIL: a mood is below ${MIN_RESULTS} with no refinements.`);
  return ok;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function searchKeyword(query: string): Promise<KeywordHit[]> {
  const data = await tmdb<{ results?: KeywordHit[] }>("/search/keyword", { query });
  return data.results ?? [];
}

async function keywords(): Promise<boolean> {
  let ok = true;
  for (const [key, { id, name }] of Object.entries(TMDB_KEYWORDS)) {
    await sleep(CALL_GAP_MS);
    const found = await tmdbJsonOptional<KeywordHit>(`/keyword/${id}`, {}, REVALIDATE);
    if (found.name && normalise(found.name) === normalise(name)) {
      console.log(`✓ ${key}: ${id} = "${found.name}"`);
      continue;
    }
    ok = false;
    const actual = found.name ? `"${found.name}"` : "not found";
    console.log(`✗ ${key}: ${id} is ${actual}, expected "${name}". Candidates:`);
    for (const hit of (await searchKeyword(name)).slice(0, 5)) {
      console.log(`    ${hit.id}  ${hit.name}`);
    }
  }
  return ok;
}

async function find(name: string | undefined): Promise<boolean> {
  if (!name) {
    console.error('Usage: npm run check:moods -- --find "<keyword name>"');
    return false;
  }
  for (const hit of (await searchKeyword(name)).slice(0, 10)) {
    const films = (await discover({ with_keywords: String(hit.id) })).total_results ?? 0;
    console.log(`${hit.id}  ${hit.name}  (${films} films)`);
  }
  return true;
}

type Effect = "narrows" | "widens" | "unclear";

// Narrower than either value alone means every value must hold; wider than
// either means any one is enough.
function effect(n: number, a: number, b: number): Effect {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  if (n <= lo && n < hi) return "narrows";
  if (n >= hi && n > lo) return "widens";
  return "unclear";
}

async function probePair(
  param: string,
  a: string,
  b: string,
  extra: Record<string, string> = {},
): Promise<{ comma: Effect; pipe: Effect }> {
  const count = async (value: string) =>
    (await discover({ "vote_count.gte": "200", ...extra, [param]: value }))
      .total_results ?? 0;
  const na = await count(a);
  const nb = await count(b);
  const comma = await count(`${a},${b}`);
  const pipe = await count(`${a}|${b}`);
  const on = Object.entries(extra).map(([k, v]) => ` (on ${k}=${v})`).join("");
  console.log(
    `${param}${on}: ${a}=${na} · ${b}=${nb} · "${a},${b}"=${comma} · "${a}|${b}"=${pipe}`,
  );
  return { comma: effect(comma, na, nb), pipe: effect(pipe, na, nb) };
}

const mark = (pass: boolean) => (pass ? "✓" : "✗");

async function probe(): Promise<boolean> {
  let ok = true;
  const include: [string, string, string][] = [
    ["with_genres", "35", "18"],
    [
      "with_keywords",
      String(TMDB_KEYWORDS.friendship.id),
      String(TMDB_KEYWORDS.comingOfAge.id),
    ],
  ];
  for (const [param, a, b] of include) {
    const { comma, pipe } = await probePair(param, a, b);
    const and = comma === "narrows";
    const or = pipe === "widens";
    console.log(`  comma = AND ${mark(and)} · pipe = OR ${mark(or)}`);
    ok &&= and && or;
  }

  const { comma, pipe } = await probePair("without_genres", "27", "16", {
    with_genres: "35",
  });
  // lib/moodQuery.ts comma-joins exclusions, so the comma is the one that must hold.
  const commaAny = comma === "narrows";
  console.log(
    `  excludes a film with any listed genre: comma ${mark(commaAny)} · pipe ${mark(pipe === "narrows")}`,
  );
  return ok && commaAny;
}

async function main() {
  const args = process.argv.slice(2);
  let ok: boolean;
  if (args.includes("--keywords")) ok = await keywords();
  else if (args.includes("--probe")) ok = await probe();
  else if (args.includes("--find")) ok = await find(args[args.indexOf("--find") + 1]);
  else ok = await coverage();
  if (!ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
