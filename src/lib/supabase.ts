import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Lazily initialized so the app can build/start before SUPABASE_* env vars are set.
function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      // supabase-js calls fetch() internally, which Next.js's App Router
      // caches by default in production (indefinitely, like force-cache) —
      // route-level `export const dynamic = "force-dynamic"` doesn't reliably
      // reach into a library's own fetch calls. Confirmed live: the dashboard
      // kept serving a stale snapshot after DB writes until this was added.
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getSupabase(), prop, receiver);
  },
});
