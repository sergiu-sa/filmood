import { test, expect } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// Inline animations are stilled only by globals.css's reduced-motion rule: its !important beats inline styles.

test.describe("Reduced motion", () => {
  test("stills the results loader and the grid's stagger", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockTmdb(page);
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/api\/movies\/discover(\?.*)?$/, async (route) => {
      await held;
      return route.fallback();
    });

    await page.goto("/results?mood=laugh&seed=4242");
    const label = page.getByText("Finding films for your mood...");
    await expect(label).toBeVisible();
    expect(await label.evaluate((el) => getComputedStyle(el.previousElementSibling!).animationIterationCount)).toBe("1");

    release();
    // The grid's last card (Midnight Harvest is the top pick): the first card's stagger is 0ms either way.
    const card = page.getByRole("link", { name: /weekend physics/i });
    await expect(card).toBeVisible();
    expect(await card.evaluate((el) => getComputedStyle(el.parentElement!).animationDelay)).toBe("0s");
  });
});
