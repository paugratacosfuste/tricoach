import { describe, it, expect, vi } from 'vitest';
import { getFreshAccessToken, REFRESH_BUFFER_MS } from '../freshToken';

function makeAuth(overrides: {
  session?: { access_token?: string; expires_at?: number } | null;
  refreshedSession?: { access_token?: string; expires_at?: number } | null;
}) {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: overrides.session ?? null } }),
    refreshSession: vi.fn().mockResolvedValue({ data: { session: overrides.refreshedSession ?? null } }),
  };
}

describe('getFreshAccessToken', () => {
  it('throws "Not authenticated" when no session is returned', async () => {
    const auth = makeAuth({ session: null });
    await expect(getFreshAccessToken(auth)).rejects.toThrow('Not authenticated. Please log in again.');
  });

  it('throws "Not authenticated" when session exists but access_token is missing', async () => {
    const auth = makeAuth({ session: { expires_at: nowInSeconds() + 3600 } });
    await expect(getFreshAccessToken(auth)).rejects.toThrow('Not authenticated. Please log in again.');
  });

  it('returns the access token unchanged when expiry is comfortably in the future', async () => {
    const auth = makeAuth({
      session: { access_token: 'tok-fresh', expires_at: nowInSeconds() + 3600 },
    });
    await expect(getFreshAccessToken(auth)).resolves.toBe('tok-fresh');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes when expiry is within the buffer window and returns the new token', async () => {
    const auth = makeAuth({
      session: { access_token: 'tok-near-expiry', expires_at: nowInSeconds() + 30 },
      refreshedSession: { access_token: 'tok-refreshed', expires_at: nowInSeconds() + 3600 },
    });
    await expect(getFreshAccessToken(auth)).resolves.toBe('tok-refreshed');
    expect(auth.refreshSession).toHaveBeenCalledOnce();
  });

  it('refreshes when expires_at is missing (treat as expired)', async () => {
    const auth = makeAuth({
      session: { access_token: 'tok-no-expiry' },
      refreshedSession: { access_token: 'tok-refreshed', expires_at: nowInSeconds() + 3600 },
    });
    await expect(getFreshAccessToken(auth)).resolves.toBe('tok-refreshed');
    expect(auth.refreshSession).toHaveBeenCalledOnce();
  });

  it('throws "Not authenticated" when refreshSession returns no session', async () => {
    const auth = makeAuth({
      session: { access_token: 'tok-near-expiry', expires_at: nowInSeconds() + 30 },
      refreshedSession: null,
    });
    await expect(getFreshAccessToken(auth)).rejects.toThrow('Not authenticated. Please log in again.');
  });

  it('REFRESH_BUFFER_MS is 60s (documents the policy)', () => {
    expect(REFRESH_BUFFER_MS).toBe(60_000);
  });
});

function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}
