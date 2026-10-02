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

// Nothing matches while `empty` holds; otherwise the default stub answers.
async function stubEmpty(
  page: Page,
  empty: (sp: URLSearchParams) => boolean,
  suggestion: { remove: string; total: number },
) {
  await page.route(/\/api\/movies\/discover(\?.*)?$/, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    if (!empty(sp)) return route.fallback();
    return route.fulfill({
      json: {
        moods: [{ key: "laugh", label: "Need to laugh", accent: "gold" }],
        droppedMoods: [],
        films: [],
        filters: { time: null, era: sp.get("era"), where: sp.get("where") ?? "norway" },
        seed: Number(sp.get("seed")),
        relaxed: 2,
        partial: false,
        interpreted: null,
        suggestions: [suggestion],
        relatedMoods: ["easy", "datenight", "family"],
      },
    });
  });
}

const stubEmptyWithEra = (page: Page) =>
  stubEmpty(page, (sp) => sp.has("era"), { remove: "era", total: 146 });

test.describe("Results empty state", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("a suggestion clears its filter, keeps the seed and is credited once", async ({ page }) => {
    await stubEmptyWithEra(page);
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&era=classic&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /nothing fits all of that/i })).toBeVisible();
    // The mood header keeps the page's only h1 when nothing matched.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Need to laugh");
    await expect(page.getByText(/films found/i)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: /your matches/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^Need a hug/ })).toHaveAttribute(
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

  // Old shared links: the page forwards tempo/runtime (the API reads them as a
  // Time), drops the retired language/exclude, and Any length clears all three.
  test("a Time suggestion on an old link clears every param that set it", async ({ page }) => {
    await stubEmpty(page, (sp) => ["time", "tempo", "runtime"].some((p) => sp.has(p)), {
      remove: "time",
      total: 80,
    });
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&tempo=slowburn&runtime=short&language=en&exclude=27&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /nothing fits all of that/i })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].get("tempo")).toBe("slowburn");
    expect(requests[0].get("runtime")).toBe("short");
    expect(requests[0].has("language")).toBe(false);
    expect(requests[0].has("exclude")).toBe(false);

    await page.getByRole("button", { name: "Any length · 80 films" }).click();
    await page.waitForURL((url) => !url.searchParams.has("tempo") && !url.searchParams.has("src"));
    const url = new URL(page.url()).searchParams;
    for (const param of ["time", "tempo", "runtime"]) expect(url.has(param)).toBe(false);
    expect(url.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(requests).toHaveLength(2);
    expect(requests[1].get("src")).toBe("suggestion");
    expect(requests[1].get("seed")).toBe("4242");
    for (const param of ["time", "tempo", "runtime"]) expect(requests[1].has(param)).toBe(false);
  });

  // Home's Tempo chips arrive as time=, so this forwarding is their only path to the API.
  test("forwards Time, Era and Where from the URL in one request", async ({ page }) => {
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&time=long&era=fresh&where=any&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0].get("time")).toBe("long");
    expect(requests[0].get("era")).toBe("fresh");
    expect(requests[0].get("where")).toBe("any");
    expect(requests[0].get("seed")).toBe("4242");
  });

  // Norway is the default, so loosening Where writes where=any rather than deleting it.
  test("an Anywhere suggestion sets where=any and keeps the seed", async ({ page }) => {
    await stubEmpty(page, (sp) => sp.get("where") !== "any", { remove: "where", total: 64 });
    const requests = discoverParams(page);

    await page.goto("/results?mood=laugh&seed=4242");
    await page.getByRole("button", { name: "Anywhere · 64 films" }).click();
    await page.waitForURL((url) => url.searchParams.get("where") === "any" && !url.searchParams.has("src"));
    expect(new URL(page.url()).searchParams.get("seed")).toBe("4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    expect(requests).toHaveLength(2);
    const anywhere = requests.filter((p) => p.get("where") === "any");
    expect(anywhere).toHaveLength(1);
    expect(anywhere[0].get("src")).toBe("suggestion");
    expect(anywhere[0].get("seed")).toBe("4242");
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
    await page.getByRole("link", { name: /^Need a hug/ }).click();
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
    await page.getByRole("link", { name: /^Need a hug/ }).click();
    await page.waitForURL((url) => url.searchParams.get("mood") === "easy" && !url.searchParams.has("src"));

    await page.goBack();
    await page.waitForURL(/era=classic/);
    await expect(page.getByRole("heading", { level: 2, name: /nothing fits/i })).toBeVisible();

    const easyDone = page.waitForEvent(
      "requestfinished",
      (req) => isDiscover(req.url()) && new URL(req.url()).searchParams.get("mood") === "easy",
    );
    releaseEasy();
    await easyDone;
    // A stale answer would render a frame or two after its body arrives.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

    await expect(page.getByRole("heading", { level: 2, name: /nothing fits/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toHaveCount(0);
  });
});
