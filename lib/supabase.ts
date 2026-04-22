import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy singleton — avoids crashing at module load during Next.js static
// prerender when env vars aren't set. Mirrors the pattern in supabase-server.ts.
// The Proxy preserves the original `supabase.xxx` call-site ergonomics while
// deferring client creation until the first property access.
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
