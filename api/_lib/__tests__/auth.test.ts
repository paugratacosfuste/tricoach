// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { VercelRequest } from "@vercel/node";

// Hoist the mock state so the vi.mock factory (which is also hoisted) can
// reference it safely in any vitest version.
const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

// Module under test imported AFTER vi.mock so the mock takes effect.
import {
  verifySupabaseJwt,
  UnauthorizedError,
  __resetServiceClientForTests,
} from "../auth";

function makeReq(headers: Record<string, string> = {}): VercelRequest {
  return { headers } as unknown as VercelRequest;
}

describe("verifySupabaseJwt", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    __resetServiceClientForTests();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "fake-service-role-for-tests";
  });

  it("throws UnauthorizedError(missing_authorization_header) when header is missing", async () => {
    await expect(verifySupabaseJwt(makeReq())).rejects.toMatchObject({
      name: "UnauthorizedError",
      code: "missing_authorization_header",
    });
  });

  it("throws UnauthorizedError(malformed_authorization_header) when scheme is not Bearer", async () => {
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Basic abc" })),
    ).rejects.toMatchObject({
      name: "UnauthorizedError",
      code: "malformed_authorization_header",
    });
  });

  it("throws UnauthorizedError(empty_bearer_token) when bearer value is empty", async () => {
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Bearer " })),
    ).rejects.toMatchObject({
      name: "UnauthorizedError",
      code: "empty_bearer_token",
    });
  });

  it("throws UnauthorizedError(oversized_bearer_token) when token exceeds length cap", async () => {
    const huge = "x".repeat(8000);
    await expect(
      verifySupabaseJwt(makeReq({ authorization: `Bearer ${huge}` })),
    ).rejects.toMatchObject({
      name: "UnauthorizedError",
      code: "oversized_bearer_token",
    });
    // No round-trip to Supabase for oversized tokens.
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedError when Supabase rejects the token", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: { name: "AuthError", message: "invalid token", status: 401 },
    });
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Bearer invalid.jwt" })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws UnauthorizedError when Supabase returns no user and no error", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Bearer x.y.z" })),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("throws plain Error (NOT UnauthorizedError) when Supabase returns 5xx", async () => {
    // Transient infrastructure failure — must surface as 500 to client,
    // not as 401, so the user is not falsely told their session expired.
    mockGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: {
        name: "AuthError",
        message: "service unavailable",
        status: 503,
      },
    });
    const promise = verifySupabaseJwt(
      makeReq({ authorization: "Bearer t.t.t" }),
    );
    await expect(promise).rejects.toThrow();
    await expect(promise).rejects.not.toBeInstanceOf(UnauthorizedError);
  });

  it("returns userId and email when token is valid", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
          aud: "authenticated",
        },
      },
      error: null,
    });
    const result = await verifySupabaseJwt(
      makeReq({ authorization: "Bearer valid.jwt.token" }),
    );
    expect(result).toEqual({ userId: "user-123", email: "test@example.com" });
    expect(mockGetUser).toHaveBeenCalledWith("valid.jwt.token");
  });

  it("falls back to VITE_SUPABASE_URL when SUPABASE_URL is not set", async () => {
    delete process.env.SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = "https://fallback.supabase.co";
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: "u", email: "" } },
      error: null,
    });
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Bearer t" })),
    ).resolves.toEqual({ userId: "u", email: "" });
  });

  it("throws (not Unauthorized) when Supabase env is misconfigured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    await expect(
      verifySupabaseJwt(makeReq({ authorization: "Bearer t" })),
    ).rejects.not.toBeInstanceOf(UnauthorizedError);
  });
});
