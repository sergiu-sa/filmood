import { test, expect, type Page } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";
import { mockTmdb } from "./fixtures/tmdb";

// Needs a server with the service-role key (every watchlist route uses the admin client), and
// writes the production watchlists table for the e2e user, so it removes what it adds.
// The rating and year come from real TMDB on the server, which page.route can't stub: only the title is asserted.

const FILM = { movie_id: 550, movie_title: "Fight Club", poster_path: null };
const removeFilm = { data: { movie_id: FILM.movie_id } };

// page.request sends no Authorization header (the session lives in localStorage), so read the token there.
async function authHeaders(page: Page) {
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
    return key ? (JSON.parse(localStorage.getItem(key) ?? "{}").access_token as string | undefined) : undefined;
  });
  expect(token).toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

let headers: Record<string, string> | undefined;

// Not a finally: a timeout closes the page's context before a finally runs, and page.request with it.
test.afterEach(async ({ request }) => {
  if (!headers) return;
  const res = await request.delete("/api/watchlist/remove", { headers, ...removeFilm });
  headers = undefined;
  expect(res.ok()).toBe(true);
});

test("a saved film is on /watchlist until Remove deletes it", async ({ page, request }) => {
  // The dashboard after login hits /api/movies on load.
  await mockTmdb(page);
  await loginAsTestUser(page);
  headers = await authHeaders(page);

  // A run whose cleanup never ran can have left the film saved.
  expect((await request.delete("/api/watchlist/remove", { headers, ...removeFilm })).ok()).toBe(true);
  expect((await request.post("/api/watchlist/add", { headers, data: FILM })).status()).toBe(201);

  const card = page.getByRole("heading", { level: 3, name: FILM.movie_title });
  await page.goto("/watchlist");
  await expect(card).toBeVisible({ timeout: 15_000 });

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
});
