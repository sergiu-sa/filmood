import { test, expect, type Page } from "@playwright/test";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

// The mood header pushes (Back returns the previous moods), keeps the seed and
// every filter, and credits each change once through src.

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/api/movies/discover") params.push(url.searchParams);
  });
  return params;
}

const urlParams = (page: Page) => new URL(page.url()).searchParams;

/** The discover response for a request credited to `src`. */
const answered = (page: Page, src: string) =>
  page.waitForResponse((res) => {
    const url = new URL(res.url());
    return url.pathname === "/api/movies/discover" && url.searchParams.get("src") === src;
  });

// A duplicate request would come from the page's effect re-running after the answer renders.
const settle = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/** Answers every discover request with these fields over the default stub's. */
async function stubDiscover(page: Page, fields: (sp: URLSearchParams) => Record<string, unknown>) {
  await page.route(/\/api\/movies\/discover(\?.*)?$/, (route) => {
    const sp = new URL(route.request().url()).searchParams;
    return route.fulfill({
      json: {
        moods: [{ key: "laugh", label: "Need to laugh", accent: "gold" }],
        droppedMoods: [],
        films: fakeFilms.map((f) => ({ ...f, moodKeys: ["laugh"] })),
        filters: { time: sp.get("time"), era: sp.get("era"), where: "norway" },
        seed: Number(sp.get("seed")),
        relaxed: 0,
        partial: false,
        interpreted: null,
        suggestions: [],
        relatedMoods: [],
        ...fields(sp),
      },
    });
  });
}

test.describe("Results mood header", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("adding a mood keeps the filters and seed, fetches once, and Back undoes it", async ({ page }) => {
    const requests = discoverParams(page);
    await page.goto("/results?mood=laugh&time=short&seed=4242");
    await expect(page.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await settle(page);
    expect(requests).toHaveLength(1);

    const added = answered(page, "tile");
    await page.getByRole("button", { name: "Add a mood" }).click();
    await page.getByRole("dialog", { name: "Add a mood" }).getByRole("link", { name: /^Go dark —/ }).click();
    await page.waitForURL((url) => url.searchParams.get("mood") === "laugh,dark" && !url.searchParams.has("src"));
    expect(urlParams(page).get("time")).toBe("short");
    expect(urlParams(page).get("seed")).toBe("4242");

    await added;
    await settle(page);
    expect(requests).toHaveLength(2);
    expect(requests[1].get("mood")).toBe("laugh,dark");
    expect(requests[1].get("src")).toBe("tile");
    expect(requests[1].get("seed")).toBe("4242");

    await page.goBack();
    await page.waitForURL((url) => url.searchParams.get("mood") === "laugh");
    expect(urlParams(page).get("time")).toBe("short");
    expect(urlParams(page).get("seed")).toBe("4242");
  });

  test("removing the last mood goes home", async ({ page }) => {
    await page.goto("/results?mood=laugh&seed=4242");
    await page.getByRole("button", { name: "Remove Need to laugh" }).click();
    await page.waitForURL((url) => url.pathname === "/");
  });

  test("the text's reading is echoed and can be edited", async ({ page }) => {
    await stubDiscover(page, (sp) => ({
      moods: [{ key: "dark", label: "Go dark", accent: "ember" }],
      filters: { time: "long", era: null, where: "norway" },
      interpreted: { text: sp.get("text"), moods: ["dark"], era: null, time: "long", unmatched: ["heist"] },
    }));
    const requests = discoverParams(page);

    await page.goto("/results?text=slow%20burn%20noir%20heist&seed=4242");
    await expect(page.getByText("We read “slow burn noir heist” as Go dark · Long & immersive.")).toBeVisible();
    await expect(page.getByText("Didn't recognise: heist.")).toBeVisible();
    // The text would bring it straight back, so its chip can't remove it.
    await expect(page.getByRole("list", { name: "Moods" }).getByText("Go dark")).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove Go dark" })).toHaveCount(0);
    await settle(page);
    expect(requests).toHaveLength(1);

    const edited = answered(page, "text");
    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByRole("textbox", { name: "Describe your mood" }).fill("funny");
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("text") === "funny" && !url.searchParams.has("src"));
    expect(urlParams(page).get("seed")).toBe("4242");

    await edited;
    await settle(page);
    expect(requests).toHaveLength(2);
    expect(requests[1].get("text")).toBe("funny");
    expect(requests[1].get("src")).toBe("text");
    expect(requests[1].get("seed")).toBe("4242");
  });

  test("an old three-mood link says which mood it left out", async ({ page }) => {
    await stubDiscover(page, (sp) => ({
      moods: [
        { key: "laugh", label: "Need to laugh", accent: "gold" },
        { key: "cry", label: "Need to let it out", accent: "blue" },
      ],
      droppedMoods: sp.get("mood") === "laugh,cry,dark" ? ["dark"] : [],
    }));
    await page.goto("/results?mood=laugh,cry,dark&seed=4242");
    await expect(page.getByText("Two moods at a time — left out Go dark.")).toBeVisible();
    await expect(page.getByRole("button", { name: "2 of 2 moods" })).toBeDisabled();
  });
});
