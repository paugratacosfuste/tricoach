/**
 * Returns a Supabase access token guaranteed to be valid for at least
 * REFRESH_BUFFER_MS into the future. If the cached session is missing or
 * expiring within that window, calls `refreshSession` proactively.
 *
 * Without this guard, a user whose tab has been idle long enough for
 * `expires_at` to pass receives a 401 from `/api/generate-week` and is
 * forced to log in again. Refreshing one round-trip earlier turns that
 * into a transparent retry. (Item-8)
 */

export const REFRESH_BUFFER_MS = 60_000;

const NOT_AUTHENTICATED = 'Not authenticated. Please log in again.';

interface SessionLike {
  access_token?: string;
  expires_at?: number;
}

interface AuthClientLike {
  getSession: () => Promise<{ data: { session: SessionLike | null } }>;
  refreshSession: () => Promise<{ data: { session: SessionLike | null } }>;
}

function isExpiringSoon(session: SessionLike, nowMs: number): boolean {
  if (typeof session.expires_at !== 'number') return true;
  return session.expires_at * 1000 - nowMs < REFRESH_BUFFER_MS;
}

export async function getFreshAccessToken(auth: AuthClientLike): Promise<string> {
  const { data: { session } } = await auth.getSession();

  if (!session || !session.access_token) {
    throw new Error(NOT_AUTHENTICATED);
  }

  if (!isExpiringSoon(session, Date.now())) {
    return session.access_token;
  }

  const { data: { session: refreshed } } = await auth.refreshSession();
  if (!refreshed?.access_token) {
    throw new Error(NOT_AUTHENTICATED);
  }
  return refreshed.access_token;
}
