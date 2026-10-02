import { test, expect, type Page } from "@playwright/test";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

const DISCOVER = /\/api\/movies\/discover(\?.*)?$/;
const isDiscover = (url: string) => new URL(url).pathname === "/api/movies/discover";

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    if (isDiscover(req.url())) params.push(new URL(req.url()).searchParams);
  });
  return params;
}

// A duplicate request would come from the page's effect re-running after the answer renders.
const settle = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

const topPick = (page: Page) => page.getByRole("heading", { level: 2, name: /midnight harvest/i });

const NO_MOOD_WORD = "Add a feeling word — like 'funny', 'dark', or 'cozy'. Era or tempo alone isn't enough.";

test.describe("Results notices", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("a failed load retries the same query with one request", async ({ page }) => {
    let failedOnce = false;
    await page.route(DISCOVER, (route) => {
      if (failedOnce) return route.fallback();
      failedOnce = true;
      // Not JSON, like a platform error page: the copy mustn't be a parse error.
      return route.fulfill({ status: 500, contentType: "text/html", body: "<html>Internal Server Error</html>" });
    });
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&seed=4242");
    await expect(page.getByRole("heading", { level: 1, name: "Couldn't reach the film database." })).toBeVisible();
    await expect(page.getByText(/unexpected token/i)).toHaveCount(0);
    expect(requests).toHaveLength(1);

    const answered = page.waitForResponse((res) => isDiscover(res.url()));
    await page.getByRole("button", { name: "Try again" }).click();
    await answered;
    await expect(topPick(page)).toBeVisible();
    await settle(page);

    expect(requests).toHaveLength(2);
    expect(requests[1].toString()).toBe(requests[0].toString());
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Need to laugh");
  });

  test("a query that failed earlier shows its answer when Back and Forward refetch it", async ({ page }) => {
    let failedOnce = false;
    await page.route(DISCOVER, (route) => {
      const blend = new URL(route.request().url()).searchParams.get("mood") === "laugh,dark";
      if (!blend || failedOnce) return route.fallback();
      failedOnce = true;
      return route.fulfill({ status: 500, json: { error: "Failed to discover films" } });
    });

    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();
    await page.getByRole("button", { name: "Add a mood" }).click();
    await page.getByRole("dialog", { name: "Add a mood" }).getByRole("link", { name: /^Go dark —/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Couldn't reach the film database." })).toBeVisible();

    await page.goBack();
    await expect(topPick(page)).toBeVisible();
    const refetched = page.waitForResponse(
      (res) => isDiscover(res.url()) && new URL(res.url()).searchParams.get("mood") === "laugh,dark",
    );
    await page.goForward();
    await refetched;
    await settle(page);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Need to laugh");
    await expect(topPick(page)).toBeVisible();
  });

  test("a 400 shows the route's message, no retry, and the text to edit", async ({ page }) => {
    await page.route(DISCOVER, (route) => {
      const sp = new URL(route.request().url()).searchParams;
      if (sp.get("text") !== "80s") return route.fallback();
      return route.fulfill({ status: 400, json: { error: NO_MOOD_WORD } });
    });
    const requests = discoverParams(page);

    await page.goto("/results?text=80s&seed=4242");
    await expect(page.getByRole("heading", { level: 1, name: NO_MOOD_WORD })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Pick a mood" })).toHaveAttribute("href", "/");

    const field = page.getByRole("textbox", { name: "Describe your mood" });
    await expect(field).toHaveValue("80s");
    const answered = page.waitForResponse(
      (res) => isDiscover(res.url()) && new URL(res.url()).searchParams.get("src") === "text",
    );
    await field.fill("funny 80s");
    await field.press("Enter");
    await answered;
    await page.waitForURL((url) => url.searchParams.get("text") === "funny 80s" && !url.searchParams.has("src"));
    expect(new URL(page.url()).searchParams.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeVisible();
    await settle(page);

    expect(requests).toHaveLength(2);
    expect(requests[1].get("src")).toBe("text");
  });

  test("a blend leads with the films that fit both moods, no top pick", async ({ page }) => {
    await page.route(DISCOVER, (route) => {
      const sp = new URL(route.request().url()).searchParams;
      return route.fulfill({
        json: {
          moods: [
            { key: "laugh", label: "Need to laugh", accent: "gold" },
            { key: "dark", label: "Go dark", accent: "ember" },
          ],
          droppedMoods: [],
          films: fakeFilms.map((f, i) => ({ ...f, moodKeys: i === 0 ? ["laugh", "dark"] : i % 2 ? ["dark"] : ["laugh"] })),
          filters: { time: null, era: null, where: "norway" },
          seed: Number(sp.get("seed")),
          relaxed: 0,
          partial: false,
          interpreted: null,
          suggestions: [],
          relatedMoods: [],
        },
      });
    });

    await page.goto("/results?mood=laugh,dark&seed=4242");
    const both = page.locator("section").filter({ has: page.getByRole("heading", { name: "Fits both moods" }) });
    await expect(both).toBeVisible();
    await expect(both).toContainText("Need to laugh");
    await expect(both).toContainText("Go dark");
    await expect(page.getByRole("heading", { level: 2, name: "From each mood" })).toBeVisible();
    await expect(topPick(page)).toHaveCount(0);
    await expect(both.getByRole("link", { name: /Midnight Harvest.*Fits Need to laugh and Go dark/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /The Quiet Algorithm.*From Go dark/ })).toBeVisible();
  });
});
