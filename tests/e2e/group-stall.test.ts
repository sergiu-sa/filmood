import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { loginAsTestUser } from "./fixtures/auth";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

// Puts a session straight into swiping with the secret key from .env.local, like group-swipe.test.ts:
// building a real deck would call TMDB from the server, which mockTmdb can't reach.
loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const adminClient = () => createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
test.skip(!url || !secretKey, "needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

let sessionId: string | undefined;
let guest: Page | undefined;

test.afterEach(async () => {
  await guest?.context().close();
  guest = undefined;
  if (!sessionId) return;
  const { error } = await adminClient().from("sessions").delete().eq("id", sessionId);
  sessionId = undefined;
  if (error) throw error;
});

/** The seeded e2e user hosts, a guest joins, and the session goes straight to swiping. */
async function swipingSession(request: APIRequestContext) {
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({
    email: process.env.E2E_USER_EMAIL!,
    password: process.env.E2E_USER_PASSWORD!,
  });
  if (signInError) throw signInError;
  const host = { Authorization: `Bearer ${signedIn.session.access_token}` };

  const created = await request.post("/api/group/create", { headers: host, data: {} });
  expect(created.ok()).toBe(true);
  const session = (await created.json()) as { code: string; sessionId: string };
  sessionId = session.sessionId;
  const joined = await request.post("/api/group/join", { data: { code: session.code, nickname: "Guest" } });
  expect(joined.ok()).toBe(true);
  const { participantId } = (await joined.json()) as { participantId: string };

  const deck = fakeFilms.map((f) => ({ ...f, mood_keys: ["laugh"] }));
  const { error } = await adminClient().from("sessions").update({ status: "swiping", movie_deck: deck }).eq("id", sessionId);
  if (error) throw error;
  return { code: session.code, participantId, host };
}

async function openAsGuest(page: Page, participantId: string, path: string) {
  await mockTmdb(page);
  await page.addInitScript((id) => localStorage.setItem("participantId", id), participantId);
  await page.goto(path);
}

const card = (page: Page, title: string) => page.getByRole("img", { name: `${title} poster` });

test("the host finishes without a guest who stopped swiping, and the guest is told", async ({ browser, page, request }) => {
  const { code, participantId, host } = await swipingSession(request);
  for (const film of fakeFilms) {
    const vote = await request.post(`/api/group/${code}/swipe`, { headers: host, data: { movieId: film.id, vote: "yes" } });
    expect(vote.ok()).toBe(true);
  }

  guest = await browser.newPage();
  await openAsGuest(guest, participantId, `/group/${code}/swipe`);
  await expect(card(guest, fakeFilms[0].title)).toBeVisible();

  await mockTmdb(page);
  await loginAsTestUser(page);
  await page.goto(`/group/${code}/swipe`);
  await page.getByRole("button", { name: "Finish without Guest" }).click();
  await expect(page.getByText("Guest hasn't finished. Finishing now removes them and their votes so far.")).toBeVisible();
  await page.getByRole("button", { name: "Finish without Guest" }).click();
  await expect(page.getByRole("button", { name: /see group results/i })).toBeVisible();

  // The guest's 2 s poll gets a 403 now that the seat is gone.
  await expect(guest.getByRole("heading", { level: 1, name: "You're no longer in this session" })).toBeVisible({ timeout: 10_000 });
  const admin = adminClient();
  const { data: row, error } = await admin.from("sessions").select("status").eq("id", sessionId!).single();
  if (error) throw error;
  expect(row.status).toBe("done");
  const { count } = await admin.from("session_participants").select("id", { count: "exact", head: true }).eq("session_id", sessionId!);
  expect(count).toBe(1);
});

test("a guest who enters the code again mid-game lands back in the game", async ({ page, request }) => {
  const { code, participantId } = await swipingSession(request);

  await openAsGuest(page, participantId, `/group?tab=join&code=${code}`);
  await page.getByLabel("Joining as guest").fill("Guest");
  await page.getByRole("button", { name: "Join session" }).click();

  await page.waitForURL(`**/group/${code}/swipe`);
  await expect(card(page, fakeFilms[0].title)).toBeVisible();
});

test("a guest sees the session has expired mid-swipe, not a vote that didn't save", async ({ page, request }) => {
  const { code, participantId } = await swipingSession(request);
  await openAsGuest(page, participantId, `/group/${code}/swipe`);
  await expect(card(page, fakeFilms[0].title)).toBeVisible();

  const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
  const { error } = await adminClient().from("sessions").update({ created_at: fiveHoursAgo }).eq("id", sessionId!);
  if (error) throw error;
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("heading", { level: 1, name: "This session has expired" })).toBeVisible();
  await expect(page.getByText(/didn't save/)).toHaveCount(0);
});
