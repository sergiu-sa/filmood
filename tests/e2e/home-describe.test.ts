import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// The home describe field reads the text before it searches, and never searches
// text the route would reject for having no mood word.

function discoverParams(page: Page): URLSearchParams[] {
  const params: URLSearchParams[] = [];
  page.on("request", (req) => {
    const url = new URL(req.url());
    if (url.pathname === "/api/movies/discover") params.push(url.searchParams);
  });
  return params;
}

test.describe("Home describe field", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
    await page.goto("/");
    await page.getByRole("button", { name: /open the mood board/i }).click();
  });

  test("reads the text, then searches it once with src=text", async ({ page }) => {
    const requests = discoverParams(page);
    const field = page.getByLabel("Or describe it in your own words");
    await field.fill("cozy 80s heist with robots");

    const reading = page.getByRole("status");
    for (const part of ["We'll read that as", "Need a hug", "Need a rush", "Before 1990", "Didn't recognise: robots"]) {
      await expect(reading).toContainText(part);
    }

    await field.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("text") === "cozy 80s heist with robots" && url.searchParams.has("seed"));
    await expect(page.getByRole("heading", { level: 1, name: "Need to laugh" })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].get("text")).toBe("cozy 80s heist with robots");
    expect(requests[0].get("src")).toBe("text");
  });

  test("text with no mood word asks for one and doesn't search", async ({ page }) => {
    const requests = discoverParams(page);
    const field = page.getByLabel("Or describe it in your own words");
    await field.fill("80s");
    await expect(page.getByRole("status")).toContainText("Add a feeling word");

    await field.press("Enter");
    // aria-disabled, so Playwright won't click it unforced; a person still can.
    await page.getByRole("button", { name: "Show films" }).click({ force: true });
    // A push would have changed the URL by the next frames.
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await expect(page).toHaveURL(/\/$/);
    expect(requests).toHaveLength(0);
  });
});
