import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// The filter bar writes the URL with replace and keeps the seed; each change
// is one discover request, credited to the bar through src.

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/api/movies/discover") params.push(url.searchParams);
  });
  return params;
}

const topPick = (page: Page) => page.getByRole("heading", { level: 2, name: /midnight harvest/i });
const liveRegion = (page: Page) => page.locator('p.sr-only[aria-live="polite"]');
const urlParams = (page: Page) => new URL(page.url()).searchParams;

test.describe("Results filter bar", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("a filter keeps the seed, fetches once and sticks under the header", async ({ page }) => {
    // Hold the filtered answer, so the page can be checked while it's busy.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/movies\/discover(\?.*)?$/, async (route) => {
      if (new URL(route.request().url()).searchParams.get("time") === "short") await held;
      return route.fallback();
    });
    const requests = discoverParams(page);
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();
    expect(requests).toHaveLength(1);

    await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio", { name: "Under 100 min" }).click();
    await page.waitForURL((url) => url.searchParams.get("time") === "short" && !url.searchParams.has("src"));
    expect(urlParams(page).get("seed")).toBe("4242");

    // The last answer stays on screen, dimmed, and the count goes quiet until the new one lands.
    const results = page.locator('[aria-busy="true"]');
    await expect(results).toHaveCSS("opacity", "0.5");
    await expect(results.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();
    await expect(liveRegion(page)).toHaveText("");
    release();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await expect(liveRegion(page)).toHaveText("5 films");

    expect(requests).toHaveLength(2);
    expect(requests[1].get("time")).toBe("short");
    expect(requests[1].get("src")).toBe("filter");
    expect(requests[1].get("seed")).toBe("4242");

    await page.mouse.wheel(0, 600);
    const bar = page.getByRole("region", { name: "Filters" });
    await expect
      .poll(async () => {
        const [barBox, headerBox] = await Promise.all([bar.boundingBox(), page.locator("header").boundingBox()]);
        return Math.abs(barBox!.y - (headerBox!.y + headerBox!.height));
      })
      .toBeLessThanOrEqual(1);
  });

  test("Shuffle writes a new seed and fetches once", async ({ page }) => {
    const requests = discoverParams(page);
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();

    await page.getByRole("button", { name: "Shuffle" }).click();
    await page.waitForURL((url) => url.searchParams.get("seed") !== "4242" && !url.searchParams.has("src"));
    const seed = urlParams(page).get("seed");
    await expect(liveRegion(page)).toHaveText("5 films");

    expect(requests).toHaveLength(2);
    expect(requests[1].get("seed")).toBe(seed);
    expect(requests[1].get("src")).toBe("shuffle");
  });

  test("a guest's picked services are searched and remembered", async ({ page }) => {
    const requests = discoverParams(page);
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();

    await page.getByRole("radio", { name: "My services" }).click();
    const picker = page.getByRole("dialog", { name: "Which services do you have?" });
    await picker.getByRole("checkbox", { name: "Netflix" }).check();
    await picker.getByRole("checkbox", { name: "Viaplay" }).check();
    await picker.getByRole("button", { name: "Show films on 2 services" }).click();

    await page.waitForURL((url) => url.searchParams.get("where") === "mine" && !url.searchParams.has("src"));
    expect(urlParams(page).get("services")).toBe("netflix,viaplay");
    expect(urlParams(page).get("seed")).toBe("4242");
    await expect(liveRegion(page)).toHaveText("5 films");
    expect(requests).toHaveLength(2);
    expect(requests[1].get("src")).toBe("filter");
    expect(await page.evaluate(() => localStorage.getItem("filmood:services"))).toBe("netflix,viaplay");

    await page.reload();
    await expect(topPick(page)).toBeVisible();
    expect(requests).toHaveLength(3);
    expect(requests[2].get("where")).toBe("mine");
    expect(requests[2].get("services")).toBe("netflix,viaplay");
    await expect(page.getByRole("radio", { name: "My services" })).toHaveAttribute("aria-checked", "true");
  });

  // Q1: no Where in the URL means "my default", so a remembered device's services go with it.
  test("a fresh visit uses the services this device remembers", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("filmood:services", "netflix"));
    const requests = discoverParams(page);
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();

    expect(requests).toHaveLength(1);
    expect(requests[0].get("services")).toBe("netflix");
    expect(requests[0].has("where")).toBe(false);
    await expect(page.getByRole("radio", { name: "My services" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/showing films on/i)).toHaveText(/Showing films on Netflix in Norway/);
  });
});
