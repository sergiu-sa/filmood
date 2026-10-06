import { test, expect } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// Inline animations are stilled only by globals.css's reduced-motion rule: its !important beats inline styles.

test.describe("Reduced motion", () => {
  test("stills the results loader, the grid's stagger and the poster's inline transition", async ({ page }) => {
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
    // The names pin the elements: "1" and "0s" are also what an element with no animation reports.
    const dot = await label.evaluate((el) => {
      const cs = getComputedStyle(el.previousElementSibling!);
      return { name: cs.animationName, iterations: cs.animationIterationCount, duration: parseFloat(cs.animationDuration) };
    });
    expect(dot.name).toBe("breathe");
    expect(dot.iterations).toBe("1");
    expect(dot.duration).toBeLessThan(0.001);

    release();
    // The grid's last card (Midnight Harvest is the top pick): the first card's stagger is 0ms either way.
    const card = page.getByRole("link", { name: /weekend physics/i });
    await expect(card).toBeVisible();
    const stagger = await card.evaluate((el) => {
      const cs = getComputedStyle(el.parentElement!);
      return { name: cs.animationName, delay: cs.animationDelay };
    });
    expect(stagger).toEqual({ name: "fadeUp", delay: "0s" });
    const poster = await card.getByRole("img", { name: "Weekend Physics" }).evaluate((el) => {
      const cs = getComputedStyle(el);
      return { property: cs.transitionProperty, duration: parseFloat(cs.transitionDuration) };
    });
    expect(poster.property).toBe("transform");
    expect(poster.duration).toBeLessThan(0.001);
  });
});
