import { test, expect, type Page } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";

// At phone width the results page's bottom sheets paint over the sticky header,
// backdrop included, so a tall sheet's drag handle never tucks under the navbar.

test.use({ viewport: { width: 390, height: 844 } });

/** Whether the sheet's backdrop is what's painted at the navbar's centre, and the sheet at its drag handle. */
const onTop = (page: Page, label: string) =>
  page.evaluate((label) => {
    const nav = document.querySelector("header nav")!.getBoundingClientRect();
    const sheet = document.querySelector(`[role="dialog"][aria-label="${label}"]`)!;
    const box = sheet.getBoundingClientRect();
    const atNav = document.elementFromPoint(nav.x + nav.width / 2, nav.y + nav.height / 2);
    const atHandle = document.elementFromPoint(box.x + box.width / 2, box.y + 14);
    return { navCovered: atNav === sheet.previousElementSibling, handleShown: sheet.contains(atHandle) };
  }, label);

test.describe("Results bottom sheets", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
    await page.goto("/results?mood=laugh&seed=4242");
    await expect(page.getByRole("heading", { level: 2, name: /midnight harvest/i })).toBeVisible();
  });

  test("the Time sheet covers the navbar", async ({ page }) => {
    await page.getByRole("button", { name: /^Time/ }).click();
    await expect(page.getByRole("dialog", { name: "How much time?" })).toBeVisible();
    await expect.poll(() => onTop(page, "How much time?")).toEqual({ navCovered: true, handleShown: true });
  });

  test("the add-mood sheet covers the navbar and shows its drag handle", async ({ page }) => {
    await page.getByRole("button", { name: "Add a mood" }).click();
    await expect(page.getByRole("dialog", { name: "Add a mood" })).toBeVisible();
    await expect.poll(() => onTop(page, "Add a mood")).toEqual({ navCovered: true, handleShown: true });
  });
});
