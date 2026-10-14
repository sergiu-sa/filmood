import { test, expect, type Locator } from "@playwright/test";
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

    // Every touch target in the sheet is at least 44px.
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

  // Close hands focus back to the page's search box, whose focus used to reopen the sheet.
  test("the sheet's box searches, and Close leaves the sheet closed", async ({ page }) => {
    await page.goto("/");
    const pageBox = page.getByRole("textbox", { name: /^Search films — / });
    await pageBox.tap();
    const sheet = page.getByRole("dialog", { name: "Browse & Search" });
    await expect(sheet).toBeFocused();

    const box = sheet.getByRole("textbox", { name: "Search films", exact: true });
    expect((await box.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await box.fill("quiet");
    await expect(sheet.getByRole("link", { name: /Full search/ })).toHaveAttribute("href", "/browse?q=quiet");
    await expect(pageBox).toHaveValue("quiet");

    await sheet.getByRole("button", { name: "Close" }).tap();
    await expect(pageBox).toBeFocused();
    // The reopen came a frame after focus returned; give it several.
    await page.waitForTimeout(300);
    await expect(sheet).toHaveAttribute("inert", "");
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  });

  test("every control in the search and group-session sheets is at least 44px", async ({ page }) => {
    const short = async (sheet: Locator) => {
      const found: string[] = [];
      for (const target of await sheet.locator("a[href], button, select, input").all()) {
        const { height } = (await target.boundingBox())!;
        if (height < 44) found.push(`${(await target.textContent())?.trim()} ${height}`);
      }
      return found;
    };

    // The genre chips' entry animation scales them; measure them at rest.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("textbox", { name: /^Search films — / }).tap();
    const search = page.getByRole("dialog", { name: "Browse & Search" });
    await search.getByRole("button", { name: "By Genre" }).tap();
    await expect(search.getByRole("button", { name: "Action" })).toBeVisible();
    expect(await short(search)).toEqual([]);
    await search.getByRole("button", { name: "Close" }).tap();
    await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");

    await page.getByRole("button", { name: "Start or join a session" }).tap();
    const explore = page.getByRole("dialog", { name: "Group session" });
    await expect(explore).toBeVisible();
    expect(await short(explore)).toEqual([]);
    await explore.getByRole("button", { name: "Join with code" }).tap();
    await expect(explore.getByLabel("Session code")).toBeVisible();
    expect(await short(explore)).toEqual([]);
  });

  // WCAG 2.4.11: a tile scrolled into view by focus must not sit under the pinned describe field.
  test("tabbing through the sheet never hides a tile behind the describe field", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /open the mood board/i }).tap();
    const sheet = page.getByRole("dialog", { name: "How do you want to feel?" });
    await expect(sheet).toBeVisible();
    // Type first: the reading makes the pinned footer as tall as it gets.
    await sheet.getByLabel("Or describe it in your own words").fill("cozy 80s heist with robots");
    await expect(page.getByRole("status")).toContainText("Didn't recognise");
    await sheet.getByRole("button", { name: "Close" }).focus();

    const tiles = await sheet.getByRole("link").count();
    for (let i = 0; i < tiles; i++) {
      await page.keyboard.press("Tab");
      const { name, tileBottom, footerTop } = await page.evaluate(() => {
        const tile = document.activeElement as HTMLElement;
        const footer = document.querySelector('[role="dialog"] form')!.parentElement!;
        return {
          name: tile.getAttribute("aria-label"),
          tileBottom: tile.getBoundingClientRect().bottom,
          footerTop: footer.getBoundingClientRect().top,
        };
      });
      expect(tileBottom, name ?? "").toBeLessThanOrEqual(footerTop + 1);
    }
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
