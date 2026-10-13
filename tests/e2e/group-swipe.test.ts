import path from "node:path";
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

// Puts a session straight into swiping with the secret key from .env.local, like account-delete.test.ts:
// building a real deck would call TMDB from the server, which mockTmdb can't reach.
loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const adminClient = () => createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
test.skip(!url || !secretKey, "needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

let sessionId: string | undefined;

test.afterEach(async () => {
  if (!sessionId) return;
  const { error } = await adminClient().from("sessions").delete().eq("id", sessionId);
  sessionId = undefined;
  if (error) throw error;
});

test("a vote that fails twice comes back after the last card, and the session still finishes", async ({ page, request }) => {
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
  const { code } = session;
  const joined = await request.post("/api/group/join", { data: { code, nickname: "Guest" } });
  expect(joined.ok()).toBe(true);
  const { participantId } = (await joined.json()) as { participantId: string };

  const deck = fakeFilms.map((f) => ({ ...f, mood_keys: ["laugh"] }));
  const { error } = await adminClient().from("sessions").update({ status: "swiping", movie_deck: deck }).eq("id", sessionId);
  if (error) throw error;
  for (const film of fakeFilms) {
    const vote = await request.post(`/api/group/${code}/swipe`, { headers: host, data: { movieId: film.id, vote: "yes" } });
    expect(vote.ok()).toBe(true);
  }

  // The guest's vote on the second film fails, and so does its retry.
  const lost = fakeFilms[1];
  let failures = 0;
  await page.route(`**/api/group/${code}/swipe`, async (route) => {
    const req = route.request();
    if (req.method() === "POST" && req.postDataJSON().movieId === lost.id && failures < 2) {
      failures++;
      return route.fulfill({ status: 500, json: { error: "Failed to record vote" } });
    }
    return route.continue();
  });
  await mockTmdb(page);
  await page.addInitScript((id) => localStorage.setItem("participantId", id), participantId);
  await page.goto(`/group/${code}/swipe`);

  const card = (title: string) => page.getByRole("img", { name: `${title} poster` });
  for (const film of fakeFilms) {
    await expect(card(film.title)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    if (film === lost) {
      await expect(page.getByText(`Your vote on ${lost.title} didn't save, so it's back in the deck.`)).toBeVisible();
    }
  }

  await expect(card(lost.title)).toBeVisible();
  expect(failures).toBe(2);
  await expect(page.getByText(`${fakeFilms.length} / ${fakeFilms.length}`)).toBeVisible();
  await page.keyboard.press("ArrowRight");

  await expect(page.getByRole("button", { name: /see group results/i })).toBeVisible();
  await expect(page.getByText(/didn't save/)).toHaveCount(0);
  const { data: row, error: readError } = await adminClient().from("sessions").select("status").eq("id", sessionId).single();
  if (readError) throw readError;
  expect(row.status).toBe("done");
});
