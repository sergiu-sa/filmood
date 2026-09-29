import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

const isDiscover = (url: string) => new URL(url).pathname === "/api/movies/discover";

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    if (isDiscover(req.url())) params.push(new URL(req.url()).searchParams);
  });
  return params;
}

// Nothing matches while `era` is set; without it the default stub answers.
async function stubEmptyWithEra(page: Page) {
  await page.route(/\/api\/movies\/discover(\?.*)?$/, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    if (!sp.has("era")) return route.fallback();
    return route.fulfill({
      json: {
        moods: [{ key: "laugh", label: "Need to laugh", accent: "gold" }],
        films: [],
        seed: Number(sp.get("seed")),
        relaxed: 2,
        partial: false,
        interpreted: null,
        suggestions: [{ remove: "era", total: 146 }],
        relatedMoods: ["easy", "datenight", "family"],
      },
    });
  });
}

test.describe("Results empty state", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("a suggestion clears its filter, keeps the seed and is credited once", async ({ page }) => {
    await stubEmptyWithEra(page);
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&era=classic&seed=4242");
    await expect(page.getByRole("heading", { level: 1, name: /nothing fits all of that/i })).toBeVisible();
    await expect(page.getByText(/films found/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /your matches/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Need a hug" })).toHaveAttribute(
      "href",
      "/results?mood=easy&src=related",
    );

    await page.getByRole("button", { name: "Any era · 146 films" }).click();
    await page.waitForURL((url) => !url.searchParams.has("era") && !url.searchParams.has("src"));
    expect(new URL(page.url()).searchParams.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    // Each discover request logs a search_events row, so dropping src must not refetch.
    const afterClick = requests.filter((p) => !p.has("era"));
    expect(afterClick).toHaveLength(1);
    expect(afterClick[0].get("src")).toBe("suggestion");
    expect(afterClick[0].get("seed")).toBe("4242");
  });

  test("src leaves the URL after the first fetch, so a reload isn't credited again", async ({ page }) => {
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&seed=4242&src=related");
    await page.waitForURL((url) => !url.searchParams.has("src"));
    expect(new URL(page.url()).searchParams.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(requests.map((p) => p.get("src"))).toEqual(["related"]);

    const reload = page.waitForRequest((req) => isDiscover(req.url()));
    await page.reload();
    const params = new URL((await reload).url()).searchParams;
    expect(params.get("seed")).toBe("4242");
    expect(params.has("src")).toBe(false);
  });

  test("a related mood without a seed gets one first, then sends src exactly once", async ({ page }) => {
    await stubEmptyWithEra(page);
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&era=classic&seed=4242");
    await page.getByRole("link", { name: "Need a hug" }).click();
    await page.waitForURL(
      (url) => url.searchParams.get("mood") === "easy" && url.searchParams.has("seed") && !url.searchParams.has("src"),
    );
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    const easy = requests.filter((p) => p.get("mood") === "easy");
    expect(easy).toHaveLength(1);
    expect(easy[0].get("src")).toBe("related");
    expect(easy[0].get("seed")).toBe(new URL(page.url()).searchParams.get("seed"));
    for (const p of requests) expect(p.get("seed")).toMatch(/^\d+$/);
  });

  test("a late answer for a mood you left doesn't replace the page", async ({ page }) => {
    await stubEmptyWithEra(page);
    let releaseEasy = () => {};
    const easyHeld = new Promise<void>((resolve) => (releaseEasy = resolve));
    await page.route(/\/api\/movies\/discover(\?.*)?$/, async (route) => {
      if (new URL(route.request().url()).searchParams.get("mood") === "easy") await easyHeld;
      return route.fallback();
    });

    await page.goto("/results?mood=laugh&era=classic&seed=4242");
    await page.getByRole("link", { name: "Need a hug" }).click();
    await page.waitForURL((url) => url.searchParams.get("mood") === "easy" && !url.searchParams.has("src"));

    await page.goBack();
    await page.waitForURL(/era=classic/);
    await expect(page.getByRole("heading", { level: 1, name: /nothing fits/i })).toBeVisible();

    const easyDone = page.waitForEvent(
      "requestfinished",
      (req) => isDiscover(req.url()) && new URL(req.url()).searchParams.get("mood") === "easy",
    );
    releaseEasy();
    await easyDone;
    // A stale answer would render a frame or two after its body arrives.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    await expect(page.getByRole("heading", { level: 1, name: /nothing fits/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toHaveCount(0);
  });
});
