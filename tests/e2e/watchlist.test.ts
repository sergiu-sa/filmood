import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";
import { mockTmdb } from "./fixtures/tmdb";

// Needs a server with the service-role key (every watchlist route uses the admin client), and
// writes the production watchlists table for the e2e user, so it removes what it adds.
// The rating and year come from real TMDB on the server, which page.route can't stub: only the title is asserted.

const FILM = { movie_id: 550, movie_title: "Fight Club", poster_path: null };

// page.request sends no Authorization header (the session lives in localStorage), so read the token there.
async function authHeaders(page: Page) {
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}").access_token as string | undefined) : undefined;
  });
  expect(token).toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

test("a saved film is on /watchlist until Remove deletes it", async ({ page }) => {
  // The dashboard after login hits /api/movies on load.
  await mockTmdb(page);
  await loginAsTestUser(page);
  const headers = await authHeaders(page);

  const add = await page.request.post("/api/watchlist/add", { headers, data: FILM });
  // 409: a failed run's leftover.
  expect([201, 409]).toContain(add.status());

  try {
    const card = page.getByRole("heading", { level: 3, name: FILM.movie_title });
    await page.goto("/watchlist");
    await expect(card).toBeVisible({ timeout: 15_000 });

    // Bounded well inside the test's timeout, so a failure still leaves the cleanup time to run.
    const removed = page.waitForResponse(
      (res) => res.url().endsWith("/api/watchlist/remove") && res.request().method() === "DELETE",
      { timeout: 10_000 },
    );
    await page.getByRole("button", { name: `Remove ${FILM.movie_title}` }).click();
    await expect(card).toHaveCount(0);
    expect((await removed).ok()).toBe(true);

    await page.reload();
    // Absent only counts once the list has rendered, not while the skeleton shows.
    await expect(
      page.getByText("Nothing saved yet.").or(page.getByRole("button", { name: /^Remove / })).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(card).toHaveCount(0);
  } finally {
    await page.request.delete("/api/watchlist/remove", { headers, data: { movie_id: FILM.movie_id } });
  }
});
