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

  // A drift's keyframes set transform, which replaced the glow's own centring, so the
  // glows drifted 160-300px off their spot while reduced motion showed them on it.
  test("the drifting glows drift around where reduced motion leaves them", async ({ page }) => {
    await page.route("**/api/group/GLOW01/results**", (route) =>
      route.fulfill({ json: { code: "GLOW01", participantCount: 2, topPick: null, perfect: [], strong: [], miss: [] } }),
    );
    const glows = [
      { url: "/group", selector: ".lobby-ambient", animation: "ambientDrift" },
      { url: "/group/GLOW01/results", selector: '[style*="ambientDrift"]', animation: "ambientDrift" },
      { url: "/", selector: ".hero-orb", animation: "heroOrbDrift1" },
    ];
    for (const glow of glows) {
      // The drift's first keyframe, where every cycle starts and ends.
      const left = () =>
        page.locator(glow.selector).first().evaluate((el, name) => {
          const drift = el.getAnimations().find((a) => (a as CSSAnimation).animationName === name);
          if (drift) {
            drift.pause();
            drift.currentTime = 0;
          }
          return el.getBoundingClientRect().left - el.parentElement!.getBoundingClientRect().left;
        }, glow.animation);
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(glow.url);
      const resting = await left();
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(glow.url);
      expect.soft(await left(), glow.url).toBeCloseTo(resting, 0);
    }
  });
});
