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
    await page.waitForLoadState("networkidle");

    // Dropping src from the URL must not refetch: a refetch would go out without it.
    const afterClick = requests.filter((p) => !p.has("era"));
    expect(afterClick.length).toBeGreaterThan(0);
    for (const p of afterClick) {
      expect(p.get("src")).toBe("suggestion");
      expect(p.get("seed")).toBe("4242");
    }
  });

  test("src leaves the URL after the first fetch, so a reload isn't credited again", async ({ page }) => {
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&seed=4242&src=related");
    await page.waitForURL((url) => !url.searchParams.has("src"));
    expect(new URL(page.url()).searchParams.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();
    await page.waitForLoadState("networkidle");

    expect(requests.length).toBeGreaterThan(0);
    expect(requests.map((p) => p.get("src"))).toEqual(requests.map(() => "related"));

    const reload = page.waitForRequest((req) => isDiscover(req.url()));
    await page.reload();
    const params = new URL((await reload).url()).searchParams;
    expect(params.get("seed")).toBe("4242");
    expect(params.has("src")).toBe(false);
  });
});
