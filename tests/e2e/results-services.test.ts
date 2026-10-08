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

/** The request without src, as the page's once-per-query guard compares it. */
function query(req: Request): string {
  const sp = new URL(req.url()).searchParams;
  sp.delete("src");
  return sp.toString();
}

/** Lets the page handle what has just arrived before asserting nothing changed. */
const settle = (page: Page) =>
  page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

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

  // Saved Viaplay beats the link's Netflix, so saving Netflix changes the answer, not the request.
  test("fetches the same request again after a save the route reads", async ({ page }) => {
    await loginAsTestUser(page);
    await page.route(/\/api\/streaming-preferences$/, (route) => {
      const req = route.request();
      const platforms = req.method() === "PUT" ? JSON.parse(req.postData() ?? "{}").platforms : ["Viaplay"];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ platforms }) });
    });
    const requests = discoverRequests(page);

    await page.goto("/results?mood=laugh&where=mine&services=netflix&seed=4242&src=tile");
    const line = page.getByText(/showing films on/i);
    await expect(line).toHaveText(/on Viaplay in/);
    await page.getByRole("button", { name: "Edit services" }).click();
    await page.getByRole("checkbox", { name: "Viaplay" }).uncheck();
    await page.getByRole("checkbox", { name: "Netflix" }).check();
    await page.getByRole("button", { name: "Show films on 1 service" }).click();

    await expect.poll(() => requests.length).toBe(2);
    expect(query(requests[1])).toBe(query(requests[0]));
    // The first request's src credited that search; the refetch mustn't credit it again.
    expect(new URL(requests[1].url()).searchParams.has("src")).toBe(false);
    await expect(line).toHaveText(/on Netflix in/);
    await expect(page.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    expect(requests).toHaveLength(2);
  });

  test("doesn't fetch again a query still on screen", async ({ page }) => {
    const requests = discoverRequests(page);
    let releaseB!: () => void;
    const heldB = new Promise<void>((r) => (releaseB = r));
    await page.route(/\/api\/movies\/discover(\?.*)?$/, async (route) => {
      if (new URL(route.request().url()).searchParams.get("time") === "short") await heldB;
      await route.fallback();
    });

    await page.goto("/results?mood=laugh&seed=4242");
    await expect(topPick(page)).toBeVisible();
    const time = page.getByRole("radiogroup", { name: "Time" });
    await time.getByRole("radio", { name: "Under 100 min" }).click();
    await expect.poll(() => requests.length).toBe(2);
    await time.getByRole("radio", { name: "Any" }).click();
    await expect(page).toHaveURL(/\/results\?mood=laugh&seed=4242$/);

    // B answers after the page went back to A: A stays, and nothing is busy.
    const answerB = page.waitForResponse((res) => res.request() === requests[1]);
    releaseB();
    await (await answerB).finished();
    await settle(page);
    expect(requests.map(query)).toEqual(["mood=laugh&seed=4242", "mood=laugh&time=short&seed=4242"]);
    await expect(page.locator("[aria-busy]")).toHaveAttribute("aria-busy", "false");
    await expect(time.getByRole("radio", { name: "Any" })).toHaveAttribute("aria-checked", "true");
  });
});
