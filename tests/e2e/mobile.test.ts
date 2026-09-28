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
    await page.getByRole("button", { name: /open the mood board/i }).tap();

    const sheet = page.getByRole("dialog", { name: /panel/i });
    await expect(sheet).toBeVisible();

    // Sanity check that the mood panel (not search/explore) is embedded.
    await expect(sheet.getByText(/all moods/i)).toBeVisible();

    // Close detection via body scroll lock: BottomSheet slides off-screen via
    // transform, so toBeHidden() is unreliable. Body `overflow: hidden` is set
    // on open and cleared on close — a direct readout of sheet state.
    await sheet.getByRole("button", { name: /^close$/i }).tap();

    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });
});
