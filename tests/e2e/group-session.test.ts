import { test, expect } from "@playwright/test";
import { loginAsTestUser } from "./fixtures/auth";
import { mockTmdb } from "./fixtures/tmdb";

// The host in the browser: create → lobby → disband, and create → start with an API guest → lock in moods.
// Realtime swipe matching is covered in lib/__tests__/group-gameplay.test.ts.
// TMDB is stubbed because the dashboard and lobby hit /api/movies on load.

test.describe("Group session", () => {
  test.beforeEach(async ({ page }) => {
    await mockTmdb(page);
  });

  test("logged-in host can create a session and disband it", async ({
    page,
  }) => {
    await loginAsTestUser(page);

    await page.goto("/group");

    // Header confirms Suspense resolved.
    await expect(
      page.getByRole("heading", { level: 1, name: /group session/i }),
    ).toBeVisible();

    // Wait for CTA copy to ensure SessionCreator is in logged-in state.
    // Two "Create session" buttons exist (tab toggle + CTA); nth(1) = CTA.
    await expect(page.getByText(/start a private room/i)).toBeVisible();

    const creatorCta = page
      .getByRole("button", { name: /^create session$/i })
      .nth(1);
    await expect(creatorCta).toBeEnabled();
    await creatorCta.click();

    // Wait for the create POST to return.
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/group/create") && res.request().method() === "POST",
      { timeout: 10_000 },
    );

    // SessionCreator pushes to /group/{6-char code} on success.
    await page.waitForURL(/\/group\/[A-Z0-9]{6}$/i);

    const code = new URL(page.url()).pathname.split("/").pop()!;
    expect(code).toMatch(/^[A-Z0-9]{6}$/i);

    // Code is rendered somewhere in the lobby via <InviteStrip />.
    await expect(page.getByText(code).first()).toBeVisible();

    // Host sees "Disband session" (guests see "Leave"). Click flips to a Yes/No confirm.
    await page.getByRole("button", { name: /^disband session$/i }).click();
    await page.getByRole("button", { name: /^yes$/i }).click();

    // onDisbanded → router.replace("/group").
    await page.waitForURL(/\/group(\?.*)?$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /group session/i }),
    ).toBeVisible();
  });

  // One of two locks in, so no deck is built and nothing reaches TMDB from the server.
  // A started session can't be left, so this one stays in "mood" until it expires.
  test("host locks in two moods and a Time", async ({ page }) => {
    await loginAsTestUser(page);
    await page.goto("/group");
    await expect(page.getByText(/start a private room/i)).toBeVisible();
    await page.getByRole("button", { name: /^create session$/i }).nth(1).click();
    await page.waitForURL(/\/group\/[A-Z0-9]{6}$/i);
    const code = new URL(page.url()).pathname.split("/").pop()!;

    // page.request sends no Authorization header (the session lives in localStorage), so this is a guest.
    const join = await page.request.post("/api/group/join", { data: { code, nickname: "Guest" } });
    expect(join.ok()).toBe(true);
    const { participantId } = await join.json();
    const ready = await page.request.post(`/api/group/${code}/ready`, { data: { participantId } });
    expect(ready.ok()).toBe(true);

    await page.getByRole("button", { name: /^mark as ready$/i }).click();
    // The lobby sees the guest through Realtime or its 2s poll.
    const start = page.getByRole("button", { name: /^start session$/i });
    await expect(start).toBeEnabled({ timeout: 10_000 });
    await start.click();
    await page.waitForURL(new RegExp(`/group/${code}/mood$`));

    const tile = (name: string) => page.getByRole("button", { name: new RegExp(`^${name} — `) });
    await tile("Need to laugh").click();
    await tile("Go dark").click();
    await expect(page.getByText("2 of 2")).toBeVisible();
    await tile("Need a hug").click();
    await expect(page.getByText("Two is the max — tap one of yours to swap it out.")).toBeVisible();
    await expect(tile("Need a hug")).toHaveAttribute("aria-pressed", "false");

    await page.getByRole("radiogroup", { name: "Time" }).getByRole("radio", { name: "Under 2 h" }).click();

    const posted = page.waitForRequest(
      (req) => req.url().endsWith(`/api/group/${code}/mood`) && req.method() === "POST",
    );
    await page.getByRole("button", { name: "Lock in 2 moods" }).click();
    const body = (await posted).postDataJSON();
    expect(body.moods).toEqual(["laugh", "dark"]);
    expect(body.time).toBe("medium");
    expect(body).not.toHaveProperty("tempo");

    await expect(page.getByRole("heading", { level: 1, name: "Moods submitted" })).toBeVisible();
  });
});
