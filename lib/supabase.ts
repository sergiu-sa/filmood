import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — avoids crashing at module load during Next.js static
// prerender when env vars aren't set. Mirrors the pattern in supabase-server.ts.
//
// Why the API shape differs from supabase-server.ts: clients import this as
// `import { supabase }` and use it as a value (`supabase.auth.onAuthStateChange`,
// `supabase.channel(...)`, `supabase.from(...)`). A Proxy preserves those
// call-site ergonomics while deferring real client creation until first access.
// supabase-server.ts exposes a function (`getSupabaseAdmin()`) instead because
// route handlers create the admin client on demand and don't need the same
// long-lived value-shaped surface.
let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
          "Set them in .env.local (dev) or Vercel Environment Variables (prod).",
      );
    }
    _client = createClient(url, key);
  }
  return _client;
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    // Bind methods so `this` is the real client when called as `supabase.foo()`
    // (e.g. supabase.channel / from / removeChannel read `this.rest` internally).
    return typeof value === "function" ? value.bind(client) : value;
  },
});
