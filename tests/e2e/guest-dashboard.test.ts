import { test, expect } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

test.describe("Guest dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("home renders hero, the three dashboard boxes, and no page errors", async ({
    page,
  }) => {
    // Catch real uncaught exceptions (not Next dev console noise).
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");

    // Final word cycles — assert only on the static "Play your" prefix.
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toContainText(/play your/i);

    // Each box opens its panel from a real button inside it; the boxes themselves aren't buttons.
    for (const name of ["Open the mood board", "Start or join a session", "Browse & search"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
  });

  test("theme toggle flips data-theme between dark and light", async ({
    page,
  }) => {
    await page.goto("/");

    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "dark");

    await page
      .getByRole("button", { name: /switch to light theme/i })
      .click();
    await expect(html).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: /switch to dark theme/i }).click();
    await expect(html).toHaveAttribute("data-theme", "dark");
  });

});
