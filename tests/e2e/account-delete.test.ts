import path from "node:path";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { loginAs } from "./fixtures/auth";
import { fakeFilms, mockTmdb } from "./fixtures/tmdb";

// Deletes accounts, so it makes throwaway users with the secret key from .env.local and never touches the
// seeded e2e user. Needs a server with that key too, like group-session.test.ts.
loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
// A run with the key blanked must still load this file, so no client until it's needed.
const adminClient = () => createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
test.skip(!url || !secretKey, "needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");

const PASSWORD = `Delete-${randomUUID()}1`;
let userIds: string[] = [];
let other: Page | undefined;

async function makeUser(label: string) {
  const email = `filmood-e2e-delete-${label}-${Date.now()}@example.com`;
  const { data, error } = await adminClient().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error) throw error;
  userIds.push(data.user.id);
  const client = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: signedIn, error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw signInError;
  return { id: data.user.id, email, headers: { Authorization: `Bearer ${signedIn.session.access_token}` } };
}

// Removes the sessions and seats first, so it also cleans up where the account delete itself fails.
test.afterEach(async () => {
  await other?.context().close();
  other = undefined;
  if (userIds.length === 0) return;
  const admin = adminClient();
  const ids = userIds;
  userIds = [];
  for (const { error } of [
    await admin.from("session_participants").delete().in("user_id", ids),
    await admin.from("sessions").delete().in("host_id", ids),
  ]) {
    if (error) throw error;
  }
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && error.status !== 404) throw error;
  }
});

test("deleting an account removes the sessions it hosted and its seat in others", async ({ browser, page, request }) => {
  const leaving = await makeUser("a");
  const staying = await makeUser("b");

  const create = async (headers: Record<string, string>) => {
    const res = await request.post("/api/group/create", { headers, data: {} });
    expect(res.ok()).toBe(true);
    return (await res.json()) as { code: string; sessionId: string };
  };
  const hosted = await create(leaving.headers);
  const joined = await create(staying.headers);
  const post = async (url: string, headers: Record<string, string>, data = {}) =>
    expect((await request.post(url, { headers, data })).ok()).toBe(true);
  await post("/api/group/join", leaving.headers, { code: joined.code });

  // The other player is on the mood page of the session being deleted, past the lobby, which a disband can't reach.
  await post("/api/group/join", staying.headers, { code: hosted.code });
  for (const headers of [leaving.headers, staying.headers]) await post(`/api/group/${hosted.code}/ready`, headers);
  await post(`/api/group/${hosted.code}/start`, leaving.headers);
  other = await browser.newPage();
  await mockTmdb(other);
  await loginAs(other, staying.email, PASSWORD);
  await other.goto(`/group/${hosted.code}/mood`);
  await expect(other.getByRole("heading", { level: 1, name: "How do you feel?" })).toBeVisible();

  await mockTmdb(page);
  await loginAs(page, leaving.email, PASSWORD);
  await page.goto("/profile#settings");
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  const deleted = page.waitForResponse((res) => res.url().endsWith("/api/account/delete"));
  await page.getByRole("button", { name: "Yes, delete my account" }).click();
  expect((await deleted).status()).toBe(200);
  // Not "/": the profile page's signed-out redirect to /login races DangerZone's push to "/", and usually wins.
  await page.waitForURL((u) => u.pathname !== "/profile");
  // The 2 s poll finds the session gone.
  await other.waitForURL((u) => u.pathname === "/group", { timeout: 10_000 });

  const admin = adminClient();
  const { data: gone } = await admin.auth.admin.getUserById(leaving.id);
  expect(gone.user).toBeNull();
  const count = async (table: string, column: string, value: string) => {
    const { count: n, error } = await admin.from(table).select("id", { count: "exact", head: true }).eq(column, value);
    if (error) throw error;
    return n;
  };
  expect(await count("sessions", "id", hosted.sessionId)).toBe(0);
  expect(await count("session_participants", "user_id", leaving.id)).toBe(0);
  expect(await count("sessions", "id", joined.sessionId)).toBe(1);
  expect(await count("session_participants", "session_id", joined.sessionId)).toBe(1);
});

// A guest has no Realtime, so only the poll's 404 after the deck has loaded can send them back.
test("a guest mid-swipe goes back to /group when the host deletes their account", async ({ browser, request }) => {
  const host = await makeUser("host");
  const created = await request.post("/api/group/create", { headers: host.headers, data: {} });
  expect(created.ok()).toBe(true);
  const { code, sessionId } = (await created.json()) as { code: string; sessionId: string };
  const joined = await request.post("/api/group/join", { data: { code, nickname: "Guest" } });
  expect(joined.ok()).toBe(true);
  const { participantId } = (await joined.json()) as { participantId: string };

  // Straight to swiping: building a real deck would call TMDB from the server, which mockTmdb can't reach.
  const deck = fakeFilms.map((f) => ({ ...f, mood_keys: ["laugh"] }));
  const { error } = await adminClient().from("sessions").update({ status: "swiping", movie_deck: deck }).eq("id", sessionId);
  if (error) throw error;

  other = await browser.newPage();
  await mockTmdb(other);
  await other.addInitScript((id) => localStorage.setItem("participantId", id), participantId);
  const loaded = other.waitForResponse((res) => res.url().includes(`/api/group/${code}/swipe`) && res.ok());
  await other.goto(`/group/${code}/swipe`);
  await loaded;

  expect((await request.delete("/api/account/delete", { headers: host.headers })).status()).toBe(200);
  await other.waitForURL((u) => u.pathname === "/group", { timeout: 10_000 });
});

test("a session finishes when the last player still swiping deletes their account", async ({ request }) => {
  const host = await makeUser("finisher");
  const leaving = await makeUser("unfinished");
  const created = await request.post("/api/group/create", { headers: host.headers, data: {} });
  expect(created.ok()).toBe(true);
  const { code, sessionId } = (await created.json()) as { code: string; sessionId: string };
  expect((await request.post("/api/group/join", { headers: leaving.headers, data: { code } })).ok()).toBe(true);

  const { error } = await adminClient()
    .from("sessions")
    .update({ status: "swiping", movie_deck: fakeFilms.map((f) => ({ ...f, mood_keys: ["laugh"] })) })
    .eq("id", sessionId);
  if (error) throw error;
  for (const film of fakeFilms) {
    const vote = await request.post(`/api/group/${code}/swipe`, { headers: host.headers, data: { movieId: film.id, vote: "yes" } });
    expect(vote.ok()).toBe(true);
  }

  expect((await request.delete("/api/account/delete", { headers: leaving.headers })).status()).toBe(200);
  expect((await request.get(`/api/group/${code}/results`, { headers: host.headers })).status()).toBe(400);
  // The host's next poll of the deck finishes the session.
  const swipe = await request.get(`/api/group/${code}/swipe`, { headers: host.headers });
  expect(((await swipe.json()) as { sessionStatus: string }).sessionStatus).toBe("done");
  expect((await request.get(`/api/group/${code}/results`, { headers: host.headers })).status()).toBe(200);
});
