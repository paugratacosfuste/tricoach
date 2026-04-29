import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazily-initialized Supabase service-role client for server-side use only.
 *
 * Shared by every handler / helper that needs to bypass RLS (auth check,
 * rate limit, audit log, future admin operations). Cold-start cost is paid
 * once per warm Vercel instance; subsequent imports reuse the same client.
 *
 * IMPORTANT: never import this from `src/` (browser code). The service-role
 * key would leak into the bundle.
 */
let cachedClient: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role client is not configured. " +
        "Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY " +
        "in the server environment.",
    );
  }

  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    // Tracked in LAUNCH_PLAN.md Discovered debt: a future PR should add
    // SUPABASE_URL to Vercel env and remove this fallback so the server
    // never silently uses a client-side env var.
    console.warn(
      "[supabaseAdmin] Using VITE_SUPABASE_URL as server-side fallback. " +
        "Add SUPABASE_URL to Vercel env vars to remove this warning.",
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedClient;
}

/**
 * Test-only helper: clears the cached client so tests can vary the env
 * vars between cases. Guarded by NODE_ENV so a production caller cannot
 * reset the singleton at runtime.
 */
export function __resetAdminClientForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  cachedClient = null;
}
