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

// Mock only enforceLimits + defaultUsageStore; preserve the real
// RateLimitError class so `instanceof` checks in the handler match.
const { fakeStore } = vi.hoisted(() => ({
  fakeStore: {
    countSuccessfulCalls: vi.fn(),
    sumTokens: vi.fn(),
    recordCall: vi.fn(),
  },
}));

vi.mock("../_lib/rateLimit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../_lib/rateLimit")>();
  return {
    ...actual,
    enforceLimits: vi.fn(),
    defaultUsageStore: () => fakeStore,
  };
});

import handler from "../generate-week";
import { verifySupabaseJwt, UnauthorizedError } from "../_lib/auth";
import { enforceLimits, RateLimitError } from "../_lib/rateLimit";

const verifyMock = vi.mocked(verifySupabaseJwt);
const enforceMock = vi.mocked(enforceLimits);

interface MockRes {
  res: VercelResponse;
  statusCode: () => number;
  body: () => unknown;
  headers: () => Record<string, string | number>;
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
  const headers: Record<string, string | number> = {};
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
    setHeader(name: string, value: string | number) {
      headers[name] = value;
      return res;
    },
  };
  return {
    res: res as unknown as VercelResponse,
    statusCode: () => statusCode,
    body: () => body,
    headers: () => headers,
  };
}

describe("api/generate-week handler", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    verifyMock.mockReset();
    enforceMock.mockReset();
    enforceMock.mockResolvedValue(undefined); // default: under all limits
    fakeStore.recordCall.mockReset();
    fakeStore.recordCall.mockResolvedValue(undefined);
    fakeStore.countSuccessfulCalls.mockReset();
    fakeStore.sumTokens.mockReset();
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

  it("returns 429 with Retry-After header when rate-limited", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    enforceMock.mockRejectedValueOnce(new RateLimitError("hourly", 3600));
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(429);
    expect(r.body()).toMatchObject({
      error: "rate_limit",
      limitType: "hourly",
      retryAfterSeconds: 3600,
    });
    expect(r.headers()["Retry-After"]).toBe(3600);
  });

  it("returns 500 (not 429) when rate-limit check throws a non-RateLimit error", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    enforceMock.mockRejectedValueOnce(new Error("supabase down"));
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(500);
  });

  it("does NOT call Anthropic when rate limit is exceeded", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    enforceMock.mockRejectedValueOnce(new RateLimitError("daily", 86400));
    await handler(makeReq(), makeRes().res);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("records the call in api_usage on 200 success with correct token + cost", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ text: "ok" }],
        usage: { input_tokens: 1000, output_tokens: 2000 },
      }),
    });
    await handler(makeReq(), makeRes().res);
    expect(fakeStore.recordCall).toHaveBeenCalledTimes(1);
    expect(fakeStore.recordCall).toHaveBeenCalledWith({
      userId: "u1",
      endpoint: "generate-week",
      status: 200,
      inputTokens: 1000,
      outputTokens: 2000,
      // 1000/1e6 * $3 + 2000/1e6 * $15 = 0.003 + 0.030 = 0.033
      costUsd: 0.033,
    });
  });

  it("does NOT record the call in api_usage when Anthropic returns non-200", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ error: "overloaded" }),
    });
    await handler(makeReq(), makeRes().res);
    expect(fakeStore.recordCall).not.toHaveBeenCalled();
  });

  it("returns 429 with limitType=monthly_tokens when the token-budget breach is signalled", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    enforceMock.mockRejectedValueOnce(
      new RateLimitError("monthly_tokens", 30 * 24 * 60 * 60),
    );
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(429);
    expect(r.body()).toMatchObject({
      error: "rate_limit",
      limitType: "monthly_tokens",
    });
  });

  it("enforces auth BEFORE rate-limit (rate-limit not consulted on auth failure)", async () => {
    verifyMock.mockRejectedValueOnce(new UnauthorizedError("invalid_token"));
    await handler(makeReq(), makeRes().res);
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(enforceMock).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("still returns 200 if api_usage write fails (logs error, does not block response)", async () => {
    verifyMock.mockResolvedValueOnce({
      userId: "u1",
      email: "t@example.com",
    });
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        content: [{ text: "ok" }],
        usage: { input_tokens: 100, output_tokens: 200 },
      }),
    });
    fakeStore.recordCall.mockRejectedValueOnce(new Error("supabase write failed"));
    const r = makeRes();
    await handler(makeReq(), r.res);
    expect(r.statusCode()).toBe(200);
  });
});
