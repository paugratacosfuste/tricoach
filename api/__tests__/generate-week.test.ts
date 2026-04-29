// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";

// Mock only verifySupabaseJwt; preserve the real UnauthorizedError class
// so `instanceof` checks in the handler match the real type.
vi.mock("../_lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_lib/auth")>();
  return {
    ...actual,
    verifySupabaseJwt: vi.fn(),
  };
});

import handler from "../generate-week";
import { verifySupabaseJwt, UnauthorizedError } from "../_lib/auth";

const verifyMock = vi.mocked(verifySupabaseJwt);

interface MockRes {
  res: VercelResponse;
  statusCode: () => number;
  body: () => unknown;
}

function makeReq(overrides: Partial<VercelRequest> = {}): VercelRequest {
  const defaults: Partial<VercelRequest> = {
    method: "POST",
    headers: { authorization: "Bearer fake.jwt.token" },
    body: { prompt: "fake prompt for testing" },
  };
  return { ...defaults, ...overrides } as VercelRequest;
}

function makeRes(): MockRes {
  let statusCode = 200;
  let body: unknown = null;
  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      body = payload;
      return res;
    },
    send(payload: unknown) {
      body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return {
    res: res as unknown as VercelResponse,
    statusCode: () => statusCode,
    body: () => body,
  };
}

describe("api/generate-week handler", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    verifyMock.mockReset();
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    process.env.ANTHROPIC_API_KEY = "fake-anthropic-key-for-tests";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns 405 when method is not POST", async () => {
    const r = makeRes();
    await handler(makeReq({ method: "GET" }), r.res);
    expect(r.statusCode()).toBe(405);
  });

  it("returns 401 when Authorization header is missing", async () => {
    verifyMock.mockRejectedValueOnce(
      new UnauthorizedError("missing_bearer_token"),
    );
    const r = makeRes();
    await handler(makeReq({ headers: {} }), r.res);
    expect(r.statusCode()).toBe(401);
    expect(r.body()).toEqual({ error: "unauthorized" });
  });

  it("returns 401 when JWT is invalid", async () => {
    verifyMock.mockRejectedValueOnce(new UnauthorizedError("invalid_token"));
    const r = makeRes();
    await handler(
      makeReq({ headers: { authorization: "Bearer bad.jwt.token" } }),
      r.res,
    );
    expect(r.statusCode()).toBe(401);
  });

  it("returns 500 (not 401) when auth helper throws a non-Unauthorized error", async () => {
    verifyMock.mockRejectedValueOnce(new Error("Supabase unreachable"));
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(500);
    expect(r.body()).toEqual({ error: "Server error" });
  });

  it("does NOT call Anthropic when auth fails", async () => {
    verifyMock.mockRejectedValueOnce(new UnauthorizedError("invalid_token"));
    await handler(makeReq(), makeRes().res);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns 400 when prompt is missing", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    const r = makeRes();
    await handler(makeReq({ body: {} }), r.res);
    expect(r.statusCode()).toBe(400);
  });

  it("returns 500 when ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(500);
  });

  it("forwards Anthropic 200 response on valid JWT", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    const upstreamPayload = { content: [{ text: "ok" }] };
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => upstreamPayload,
    });
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(200);
    expect(r.body()).toEqual(upstreamPayload);
  });

  it("forwards Anthropic 503 status on overload", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "overloaded" }),
    });
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(503);
  });

  it("returns 500 when Anthropic fetch itself throws", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("network down"),
    );
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(500);
  });
});
