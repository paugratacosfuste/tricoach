// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enforceLimits,
  RateLimitError,
  type UsageStore,
} from "../rateLimit";

interface FakeStore extends UsageStore {
  countSuccessfulCalls: ReturnType<typeof vi.fn>;
  sumTokens: ReturnType<typeof vi.fn>;
  recordCall: ReturnType<typeof vi.fn>;
}

function makeFakeStore(
  overrides: {
    hourlyCount?: number;
    dailyCount?: number;
    monthlyTokens?: number;
  } = {},
): FakeStore {
  // countSuccessfulCalls is called twice per enforceLimits run: first for
  // the 1h window, then for the 24h window. We return values in order.
  const counts = [overrides.hourlyCount ?? 0, overrides.dailyCount ?? 0];
  const countMock = vi.fn(async () => counts.shift() ?? 0);
  return {
    countSuccessfulCalls: countMock,
    sumTokens: vi.fn(async () => overrides.monthlyTokens ?? 0),
    recordCall: vi.fn(async () => undefined),
  } as FakeStore;
}

describe("enforceLimits", () => {
  beforeEach(() => {
    delete process.env.RATE_LIMIT_HOURLY;
    delete process.env.RATE_LIMIT_DAILY;
    delete process.env.TOKEN_BUDGET_MONTHLY;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves silently when user is well under all limits", async () => {
    const store = makeFakeStore({
      hourlyCount: 3,
      dailyCount: 10,
      monthlyTokens: 100_000,
    });
    await expect(enforceLimits("u1", store)).resolves.toBeUndefined();
  });

  it("throws RateLimitError(hourly) when 1h count is at the default limit (10)", async () => {
    const store = makeFakeStore({ hourlyCount: 10 });
    const promise = enforceLimits("u1", store);
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({
      limitType: "hourly",
      retryAfterSeconds: 60 * 60,
    });
  });

  it("throws RateLimitError(daily) when 1h count is fine but 24h count is at limit (30)", async () => {
    const store = makeFakeStore({ hourlyCount: 5, dailyCount: 30 });
    const promise = enforceLimits("u1", store);
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({ limitType: "daily" });
  });

  it("throws RateLimitError(monthly_tokens) when 30d token sum is at budget (500_000)", async () => {
    const store = makeFakeStore({
      hourlyCount: 0,
      dailyCount: 0,
      monthlyTokens: 500_000,
    });
    const promise = enforceLimits("u1", store);
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({
      limitType: "monthly_tokens",
    });
  });

  it("respects RATE_LIMIT_HOURLY env override (lower = stricter)", async () => {
    process.env.RATE_LIMIT_HOURLY = "5";
    const store = makeFakeStore({ hourlyCount: 5 });
    await expect(enforceLimits("u1", store)).rejects.toMatchObject({
      limitType: "hourly",
    });
  });

  it("respects RATE_LIMIT_HOURLY env override (higher = looser)", async () => {
    process.env.RATE_LIMIT_HOURLY = "100";
    const store = makeFakeStore({ hourlyCount: 50 });
    await expect(enforceLimits("u1", store)).resolves.toBeUndefined();
  });

  it("respects TOKEN_BUDGET_MONTHLY env override", async () => {
    process.env.TOKEN_BUDGET_MONTHLY = "1000";
    const store = makeFakeStore({ monthlyTokens: 1000 });
    await expect(enforceLimits("u1", store)).rejects.toMatchObject({
      limitType: "monthly_tokens",
    });
  });

  it("checks hourly first, then daily, then monthly (short-circuits on first breach)", async () => {
    const store = makeFakeStore({
      hourlyCount: 999,
      dailyCount: 999,
      monthlyTokens: 999_999_999,
    });
    await expect(enforceLimits("u1", store)).rejects.toMatchObject({
      limitType: "hourly",
    });
    // Daily / monthly checks should not have run.
    expect(store.sumTokens).not.toHaveBeenCalled();
  });

  it("calls store.countSuccessfulCalls with a 1-hour-ago Date for the hourly check", async () => {
    vi.useFakeTimers();
    const fixedNow = new Date("2026-04-29T12:00:00Z");
    vi.setSystemTime(fixedNow);
    const store = makeFakeStore();
    await enforceLimits("u1", store);
    const firstCallArgs = store.countSuccessfulCalls.mock.calls[0];
    expect(firstCallArgs[0]).toBe("u1");
    const since: Date = firstCallArgs[1];
    expect(since.toISOString()).toBe("2026-04-29T11:00:00.000Z");
  });
});

describe("RateLimitError", () => {
  it("exposes limitType and retryAfterSeconds, name='RateLimitError'", () => {
    const err = new RateLimitError("hourly", 3600);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RateLimitError");
    expect(err.limitType).toBe("hourly");
    expect(err.retryAfterSeconds).toBe(3600);
    expect(err.message).toContain("rate_limit");
  });
});
