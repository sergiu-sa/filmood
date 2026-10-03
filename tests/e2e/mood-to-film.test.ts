import { test, expect } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// Core user journey: dashboard → mood tile → results → film detail. TMDB fully stubbed.

test.describe("Mood → results → film detail", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("guest can tap a mood and reach a film detail page", async ({ page }) => {
    const requests: URLSearchParams[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname === "/api/movies/discover") requests.push(url.searchParams);
    });
    await page.goto("/");

    // Desktop keeps MoodPanel mounted but collapsed (and inert), so its tiles
    // aren't reachable until the board is opened.
    await page.getByRole("button", { name: /open the mood board/i }).click();
    await page.getByRole("link", { name: "Need to let it out — Moving, cathartic, beautiful" }).click();
    await page.waitForURL((url) => url.searchParams.get("mood") === "cry" && url.searchParams.has("seed"));

    // The stub always answers "laugh", whichever tile was clicked; the h1 is the mood header's.
    await expect(page.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].get("mood")).toBe("cry");
    expect(requests[0].get("src")).toBe("tile");

    // "Midnight Harvest" is the highest-rated fixture — confirms data pipeline reached UI.
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    // Assert href only — the /film/{id} page is an RSC that fetches server-side,
    // which page.route() can't intercept, so a fake ID would 404 at real TMDB.
    const href = await page.getByRole("link", { name: /view details/i }).getAttribute("href");
    expect(href).toMatch(/^\/film\/\d+$/);
  });
});
