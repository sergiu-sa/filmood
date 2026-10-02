import { test, expect } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// Mobile-only (chromium-mobile project, Pixel 5). Below 900px, DashboardShell
// swaps inline panels for a BottomSheet dialog — this covers its open/close lifecycle.

test.describe("Mobile — BottomSheet dashboard panel", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("tapping Open the mood board opens the bottom sheet and Close dismisses it", async ({
    page,
  }) => {
    await page.goto("/");

    // MoodBox's featured-mood reel stops propagation and can swallow a tap on
    // the box, so use the CTA, which calls onExpand directly.
    const opener = page.getByRole("button", { name: /open the mood board/i });
    await opener.tap();

    const sheet = page.getByRole("dialog", { name: "How do you want to feel?" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { level: 2, name: "How do you want to feel?" })).toBeVisible();

    // §9.5: every touch target in the sheet is at least 44px.
    for (const target of [
      sheet.getByRole("link", { name: "Need a hug — Warm, gentle, comforting" }),
      sheet.getByRole("button", { name: "Close" }),
      sheet.getByRole("button", { name: "Show films" }),
    ]) {
      expect((await target.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    // Close detection via body scroll lock: BottomSheet slides off-screen via
    // transform, so toBeHidden() is unreliable. Body `overflow: hidden` is set
    // on open and cleared on close — a direct readout of sheet state.
    await sheet.getByRole("button", { name: "Close" }).tap();

    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
    await expect(opener).toBeFocused();
  });

  test("tapping a mood in the sheet opens its results", async ({ page }) => {
    const requests: URLSearchParams[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname === "/api/movies/discover") requests.push(url.searchParams);
    });
    await page.goto("/");
    await page.getByRole("button", { name: /open the mood board/i }).tap();
    await page
      .getByRole("dialog", { name: "How do you want to feel?" })
      .getByRole("link", { name: "Need a hug — Warm, gentle, comforting" })
      .tap();

    await page.waitForURL((url) => url.searchParams.get("mood") === "easy" && url.searchParams.has("seed"));
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();
    expect(requests).toHaveLength(1);
    expect(requests[0].get("src")).toBe("tile");
  });

  test("a Time sheet applies a pick at once and closes", async ({ page }) => {
    const requests: URLSearchParams[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      if (url.pathname === "/api/movies/discover") requests.push(url.searchParams);
    });
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();

    await page.getByRole("button", { name: "Time Any" }).tap();
    const sheet = page.getByRole("dialog", { name: "How much time?" });
    await sheet.getByRole("radio", { name: /under 100 min/i }).tap();

    await page.waitForURL((url) => url.searchParams.get("time") === "short" && !url.searchParams.has("src"));
    await sheet.getByRole("button", { name: "Show 5 films" }).tap();
    expect(requests).toHaveLength(2);
    expect(requests[1].get("time")).toBe("short");
    expect(requests[1].get("src")).toBe("filter");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
});
