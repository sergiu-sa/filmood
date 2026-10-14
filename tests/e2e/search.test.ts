import { test, expect } from "@playwright/test";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

// mockTmdb answers search and browse with the same five films. Search answers two
// here, so a browse grid of those two can only have come from the search.
const found = fakeFilms.slice(1, 3);

test.describe("One search on home and browse", () => {
  test("a search on home lands on browse as the same search", async ({ page }) => {
    await mockTmdb(page);
    const searched = new Set<string>();
    await page.route(/\/api\/movies\/search(\?.*)?$/, (route) => {
      const from = new URL(route.request().frame().url()).pathname;
      searched.add(`${from} ${new URL(route.request().url()).searchParams.get("query")}`);
      return route.fulfill({ json: { films: found } });
    });

    await page.goto("/");
    const box = page.getByRole("textbox", { name: /^Search films/ });
    await box.fill("quiet algorithm");
    await box.press("Enter");
    await expect(page.locator(".search-grid-enter h3")).toHaveText(found.map((f) => f.title));

    await page.getByRole("link", { name: /Full search/ }).click();
    await expect(page).toHaveURL(/\/browse\?q=quiet\+algorithm$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Results for “quiet algorithm”");
    await expect(page.locator(".browse-film-grid h3")).toHaveText(found.map((f) => f.title));
    // From home, then from browse (dev's Strict Mode can send browse's twice).
    expect([...searched]).toEqual(["/ quiet algorithm", "/browse quiet algorithm"]);
  });

  test("an outage reads as an error on home and on browse", async ({ page }) => {
    await mockTmdb(page);
    const failed = { status: 500, json: { error: "Failed" } };
    await page.route(/\/api\/movies\/search(\?.*)?$/, (route) => route.fulfill(failed));
    await page.route(/\/api\/movies\/browse(\?.*)?$/, (route) => route.fulfill(failed));

    await page.goto("/");
    const box = page.getByRole("textbox", { name: /^Search films/ });
    await box.fill("dune");
    await box.press("Enter");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't reach the film database." })).toBeVisible();

    await page.goto("/browse");
    await expect(page.getByRole("alert").filter({ hasText: "Couldn't reach the film database." })).toBeVisible();
    await expect(page.getByText("No films found")).toHaveCount(0);
  });

  // spin's keyframes blended the spinner's own translateY(-50%) into a full turn,
  // which slid it down and back without turning it.
  test("home's search spinner turns in place while a search is in flight", async ({ page }) => {
    await mockTmdb(page);
    await page.route(/\/api\/movies\/search(\?.*)?$/, () => {});

    await page.goto("/");
    const box = page.getByRole("textbox", { name: /^Search films/ });
    await box.fill("dune");
    await box.press("Enter");
    const quarter = await page.waitForFunction(() => {
      const spin = document.getAnimations().find((a) => (a as CSSAnimation).animationName === "spin");
      if (!spin) return null;
      spin.pause();
      spin.currentTime = 200;
      const el = (spin.effect as KeyframeEffect).target as HTMLElement;
      const turn = new DOMMatrix(getComputedStyle(el).transform);
      const own = el.getBoundingClientRect();
      const field = el.parentElement!.getBoundingClientRect();
      return { cos: turn.a, sin: turn.b, offCentre: own.top + own.height / 2 - (field.top + field.height / 2) };
    });
    const { cos, sin, offCentre } = (await quarter.jsonValue())!;
    expect(cos).toBeCloseTo(0, 2);
    expect(sin).toBeCloseTo(1, 2);
    expect(Math.abs(offCentre)).toBeLessThan(1);
  });
});
