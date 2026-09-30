import { test, expect, type Page, type Request } from "@playwright/test";
import { mockTmdb } from "./fixtures/tmdb";
import { loginAsTestUser } from "./fixtures/auth";

// Discover resolves where=mine from a guest's services param or a signed-in
// user's saved services, so the page must forward the one and send the other.

function discoverRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on("request", (req) => {
    if (new URL(req.url()).pathname === "/api/movies/discover") requests.push(req);
  });
  return requests;
}

const topPick = (page: Page) => page.getByRole("heading", { level: 2, name: /midnight harvest/i });

test.describe("Results: My services", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("forwards a guest's services, with no auth header", async ({ page }) => {
    const requests = discoverRequests(page);

    await page.goto("/results?mood=laugh&where=mine&services=netflix,viaplay&seed=4242");
    await expect(topPick(page)).toBeVisible();

    expect(requests).toHaveLength(1);
    const sp = new URL(requests[0].url()).searchParams;
    expect(sp.get("where")).toBe("mine");
    expect(sp.get("services")).toBe("netflix,viaplay");
    expect(sp.get("seed")).toBe("4242");
    expect((await requests[0].allHeaders()).authorization).toBeUndefined();
  });

  test("sends a signed-in user's token", async ({ page }) => {
    await loginAsTestUser(page);
    const requests = discoverRequests(page);

    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();

    expect(requests).toHaveLength(1);
    expect((await requests[0].allHeaders()).authorization).toMatch(/^Bearer \S+$/);
  });
});
