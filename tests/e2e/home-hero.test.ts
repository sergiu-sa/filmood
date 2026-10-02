import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/api/movies/discover") params.push(url.searchParams);
  });
  return params;
}

test.describe("Home hero — guest", () => {
  test.beforeEach(async ({ page }) => {
    // The hero links to /results, whose discover call must never reach the real route.
    await mockTmdb(page);
    // Reduced motion stops the reel, so the word stays on its first mood, Laugh.
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("renders headline + cycling mood link + chips", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Start with mood Laugh" })).toBeVisible();
    await expect(page.getByText(/Play Your/i)).toBeVisible();
    await expect(page.getByText(/\+ 9 more/)).toBeVisible();
  });

  test("a chip opens its mood's results", async ({ page }) => {
    const requests = discoverParams(page);
    await page.goto("/");
    const hero = page.getByRole("region", { name: /Filmood — Play Your Mood/i });
    await hero.getByRole("link", { name: "Need to laugh" }).click();
    await page.waitForURL((url) => url.searchParams.get("mood") === "laugh" && url.searchParams.has("seed"));
    await expect(page.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].get("src")).toBe("tile");
  });

  test("cycling mood word is a keyboard-reachable link", async ({ page }) => {
    await page.goto("/");
    const cycler = page.getByRole("link", { name: "Start with mood Laugh" });
    await cycler.focus();
    await expect(cycler).toBeFocused();
    await cycler.press("Enter");
    await page.waitForURL((url) => url.pathname === "/results" && url.searchParams.get("mood") === "laugh");
  });
});

test.describe("Home hero — light mode", () => {
  test("renders without hydration errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(String(err)));
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
    await expect(page.getByText(/Play Your/i)).toBeVisible();
  });
});
