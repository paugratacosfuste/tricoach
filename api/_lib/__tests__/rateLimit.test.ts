// @vitest-environment node

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enforceLimits,
  RateLimitError,
  defaultUsageStore,
  type UsageStore,
} from "../rateLimit";

vi.mock("../supabaseAdmin.js", () => ({
  getAdminClient: vi.fn(),
}));
const { getAdminClient } = await import("../supabaseAdmin.js");

interface FakeStore extends UsageStore {
  countSuccessfulCalls: ReturnType<typeof vi.fn>;
  sumTokens: ReturnType<typeof vi.fn>;
  sumCost: ReturnType<typeof vi.fn>;
  recordCall: ReturnType<typeof vi.fn>;
}

function makeFakeStore(
  overrides: {
    hourlyCount?: number;
    dailyCount?: number;
    monthlyTokens?: number;
    monthlyCostUsd?: number;
  } = {},
): FakeStore {
  // countSuccessfulCalls is called twice per enforceLimits run: first for
  // the 1h window, then for the 24h window. We return values in order.
  const counts = [overrides.hourlyCount ?? 0, overrides.dailyCount ?? 0];
  const countMock = vi.fn(async () => counts.shift() ?? 0);
  return {
    countSuccessfulCalls: countMock,
    sumTokens: vi.fn(async () => overrides.monthlyTokens ?? 0),
    sumCost: vi.fn(async () => overrides.monthlyCostUsd ?? 0),
    recordCall: vi.fn(async () => undefined),
  } as FakeStore;
}

describe("enforceLimits", () => {
  beforeEach(() => {
    delete process.env.RATE_LIMIT_HOURLY;
    delete process.env.RATE_LIMIT_DAILY;
    delete process.env.TOKEN_BUDGET_MONTHLY;
    delete process.env.COST_BUDGET_MONTHLY_USD;
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

  // ── Item-12: cost-budget enforcement ────────────────────────────────
  it("throws RateLimitError(cost_budget) when 30d cost is at the default budget ($50)", async () => {
    const store = makeFakeStore({ monthlyCostUsd: 50 });
    const promise = enforceLimits("u1", store);
    await expect(promise).rejects.toBeInstanceOf(RateLimitError);
    await expect(promise).rejects.toMatchObject({
      limitType: "cost_budget",
      retryAfterSeconds: 60 * 60 * 24 * 30,
    });
  });

  it("resolves silently when 30d cost is just below the default budget", async () => {
    const store = makeFakeStore({ monthlyCostUsd: 49.999999 });
    await expect(enforceLimits("u1", store)).resolves.toBeUndefined();
  });

  it("respects COST_BUDGET_MONTHLY_USD env override (lower = stricter)", async () => {
    process.env.COST_BUDGET_MONTHLY_USD = "5";
    const store = makeFakeStore({ monthlyCostUsd: 5 });
    await expect(enforceLimits("u1", store)).rejects.toMatchObject({
      limitType: "cost_budget",
    });
  });

  it("respects COST_BUDGET_MONTHLY_USD env override (looser)", async () => {
    process.env.COST_BUDGET_MONTHLY_USD = "1000";
    const store = makeFakeStore({ monthlyCostUsd: 60 });
    await expect(enforceLimits("u1", store)).resolves.toBeUndefined();
  });

  it("falls back to default budget when COST_BUDGET_MONTHLY_USD is non-numeric", async () => {
    process.env.COST_BUDGET_MONTHLY_USD = "expensive";
    const store = makeFakeStore({ monthlyCostUsd: 50 });
    await expect(enforceLimits("u1", store)).rejects.toMatchObject({
      limitType: "cost_budget",
    });
  });

  it("checks limits in order: hourly → daily → monthly_tokens → cost_budget", async () => {
    const store = makeFakeStore({
      hourlyCount: 0,
      dailyCount: 0,
      monthlyTokens: 0,
      monthlyCostUsd: 50,
    });
    const promise = enforceLimits("u1", store);
    await expect(promise).rejects.toMatchObject({ limitType: "cost_budget" });
    // sumCost is the last check, so it ran.
    expect(store.sumCost).toHaveBeenCalledOnce();
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

// ── Item-9: api_usage INSERT retry ───────────────────────────────────────
describe("defaultUsageStore.recordCall — retry on transient INSERT failure (Item-9)", () => {
  const sampleInput = {
    userId: "u1",
    endpoint: "generate-week",
    status: 200,
    inputTokens: 100,
    outputTokens: 200,
    costUsd: 0.0033,
  } as const;

  function mockInsertResults(results: Array<{ error: { message: string } | null }>): {
    insertSpy: ReturnType<typeof vi.fn>;
  } {
    const insertSpy = vi.fn();
    results.forEach((r) => insertSpy.mockResolvedValueOnce(r));
    vi.mocked(getAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertSpy }),
    } as never);
    return { insertSpy };
  }

  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    vi.useRealTimers();
  });

  it("succeeds on first attempt — no retry, no warn", async () => {
    const { insertSpy } = mockInsertResults([{ error: null }]);
    await expect(defaultUsageStore().recordCall(sampleInput)).resolves.toBeUndefined();
    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("retries once when first INSERT fails and resolves silently when retry succeeds", async () => {
    vi.useFakeTimers();
    const { insertSpy } = mockInsertResults([
      { error: { message: "connection reset" } },
      { error: null },
    ]);
    const promise = defaultUsageStore().recordCall(sampleInput);
    await vi.advanceTimersByTimeAsync(200);
    await expect(promise).resolves.toBeUndefined();
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("api_usage insert attempt 1 failed");
  });

  it("throws after both attempts fail (handler is responsible for swallowing it)", async () => {
    vi.useFakeTimers();
    const { insertSpy } = mockInsertResults([
      { error: { message: "first fail" } },
      { error: { message: "second fail" } },
    ]);
    // Attach a catch synchronously so advancing timers can't trigger an
    // unhandled-rejection before the expectation gets a chance to await it.
    const captured = defaultUsageStore()
      .recordCall(sampleInput)
      .then(() => null)
      .catch((e: Error) => e);
    await vi.advanceTimersByTimeAsync(200);
    const err = await captured;
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/api_usage insert failed after retry: second fail/);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  // ── Phase 1.C.4 — prompt_version round-trips into the INSERT payload ──
  it("writes the supplied promptVersion to the prompt_version column", async () => {
    const { insertSpy } = mockInsertResults([{ error: null }]);
    await defaultUsageStore().recordCall({
      ...sampleInput,
      promptVersion: "2026-05-07.1",
    });
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ prompt_version: "2026-05-07.1" }),
    );
  });

  it("writes prompt_version=null when promptVersion is omitted (legacy callers)", async () => {
    const { insertSpy } = mockInsertResults([{ error: null }]);
    await defaultUsageStore().recordCall(sampleInput);
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ prompt_version: null }),
    );
  });
});
