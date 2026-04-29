import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VercelRequest } from "@vercel/node";

/**
 * Thrown when a request is missing valid Supabase auth.
 * The handler maps this specifically to HTTP 401; any other error class
 * falls through to 500.
 *
 * `code` values: `missing_authorization_header`, `malformed_authorization_header`,
 * `empty_bearer_token`, `oversized_bearer_token`, `invalid_token`.
 */
export class UnauthorizedError extends Error {
  public readonly code: string;

  constructor(code: string) {
    super(`unauthorized:${code}`);
    this.name = "UnauthorizedError";
    this.code = code;
  }
}

export interface AuthenticatedUser {
  readonly userId: string;
  readonly email: string;
}

// Real Supabase access tokens are ~800 bytes. Vercel caps headers at 8 KB
// anyway; this is belt-and-braces against accidental large-payload calls.
const MAX_TOKEN_LENGTH = 4096;

// Lazily-initialized service-role client. Cold start cost is paid once
// per warm Vercel instance; subsequent calls reuse the same client.
let cachedServiceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cachedServiceClient) return cachedServiceClient;

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
    // Tracked in LAUNCH_PLAN.md Discovered debt: future PR should add
    // SUPABASE_URL to Vercel env and remove this fallback so the server
    // never silently uses a client-side env var.
    console.warn(
      "[auth] Using VITE_SUPABASE_URL as server-side fallback. " +
        "Add SUPABASE_URL to Vercel env vars to remove this warning.",
    );
  }

  cachedServiceClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedServiceClient;
}

/**
 * Test-only helper: clears the cached service client so tests can vary
 * the env vars between cases. Guarded by NODE_ENV so a production caller
 * cannot reset the singleton at runtime — the function is a no-op outside
 * the test environment.
 */
export function __resetServiceClientForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  cachedServiceClient = null;
}

function extractBearerToken(req: VercelRequest): string {
  const header = req.headers.authorization;
  if (!header || typeof header !== "string") {
    throw new UnauthorizedError("missing_authorization_header");
  }
  if (!header.startsWith("Bearer ")) {
    throw new UnauthorizedError("malformed_authorization_header");
  }
  const token = header.slice("Bearer ".length).trim();
  if (!token) {
    throw new UnauthorizedError("empty_bearer_token");
  }
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new UnauthorizedError("oversized_bearer_token");
  }
  return token;
}

/**
 * Verifies that the incoming request carries a valid Supabase access token.
 *
 * Returns the authenticated `{ userId, email }` on success.
 *
 * Throws `UnauthorizedError` for any auth-domain failure (missing header,
 * malformed header, expired token, unknown user, oversized token). Throws
 * a plain `Error` for infrastructure failures (env not configured;
 * Supabase 5xx) so callers can map those to HTTP 500 rather than 401.
 */
export async function verifySupabaseJwt(
  req: VercelRequest,
): Promise<AuthenticatedUser> {
  const token = extractBearerToken(req);
  const client = getServiceClient();

  const { data, error } = await client.auth.getUser(token);

  if (error) {
    // Distinguish transient Supabase infra failures from genuine auth
    // rejections. 5xx → plain Error → 500. Everything else → 401.
    const status = (error as { status?: number }).status;
    if (typeof status === "number" && status >= 500) {
      throw new Error(`Supabase auth backend error: ${error.message}`);
    }
    throw new UnauthorizedError("invalid_token");
  }
  if (!data?.user) {
    throw new UnauthorizedError("invalid_token");
  }

  return {
    userId: data.user.id,
    email: data.user.email ?? "",
  };
}
