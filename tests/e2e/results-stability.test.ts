import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// Results carry a seed in the URL so Back from a film shows the same list.
// TMDB is stubbed, so this checks the seed; the unit tests cover the order.

function discoverSeeds(page: Page): string[] {
  const seeds: string[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/api/movies/discover") seeds.push(url.searchParams.get("seed") ?? "");
  });
  return seeds;
}

const urlSeed = (page: Page) => new URL(page.url()).searchParams.get("seed");

// Dev mode mounts the page twice (React StrictMode), so the count varies; what
// matters is that no request goes out without the URL's seed.
function expectAllSeeded(seeds: string[], seed: string | null) {
  expect(seeds.length).toBeGreaterThan(0);
  expect(new Set(seeds)).toEqual(new Set([seed]));
}

test.describe("Results stability", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("writes a seed before the first fetch and keeps it on Back", async ({ page }) => {
    const seeds = discoverSeeds(page);

    await page.goto("/results?mood=laugh");
    await page.waitForURL(/[?&]seed=\d+/);
    const seed = urlSeed(page);
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(seed).toMatch(/^\d+$/);
    expectAllSeeded(seeds, seed);

    await page.getByRole("link", { name: /view details/i }).click();
    await page.waitForURL(/\/film\/\d+$/);

    await page.goBack();
    await page.waitForURL(/\/results\?/);
    expect(urlSeed(page)).toBe(seed);
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();
    expectAllSeeded(seeds, seed);
  });

  test("keeps a seed that is already in the URL", async ({ page }) => {
    const seeds = discoverSeeds(page);

    await page.goto("/results?mood=laugh&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(urlSeed(page)).toBe("4242");
    expectAllSeeded(seeds, "4242");
  });
});
