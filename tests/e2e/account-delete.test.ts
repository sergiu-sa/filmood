import path from "node:path";
import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { loginAs } from "./fixtures/auth";
import { mockTmdb } from "./fixtures/tmdb";

// Deletes accounts, so it makes two throwaway users with the secret key from .env.local and never touches the
// seeded e2e user. Needs a server with that key too, like group-session.test.ts.
loadEnv({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const secretKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
// A run with the key blanked (see NOTES → Environment) must still load this file, so no client until it's needed.
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
