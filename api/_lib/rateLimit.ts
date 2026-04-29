import { getAdminClient } from "./supabaseAdmin";

/**
 * Thrown when a user has exceeded one of the rate limits. The handler
 * maps this to HTTP 429 with a `Retry-After` header; any other error
 * class falls through to 500.
 */
export class RateLimitError extends Error {
  public readonly limitType: LimitType;
  public readonly retryAfterSeconds: number;

  constructor(limitType: LimitType, retryAfterSeconds: number) {
    super(`rate_limit:${limitType}`);
    this.name = "RateLimitError";
    this.limitType = limitType;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type LimitType = "hourly" | "daily" | "monthly_tokens";

/**
 * Storage adapter interface — abstracts the api_usage queries so tests
 * can substitute a deterministic in-memory implementation without
 * touching Supabase.
 */
export interface UsageStore {
  countSuccessfulCalls(userId: string, since: Date): Promise<number>;
  sumTokens(userId: string, since: Date): Promise<number>;
  recordCall(input: RecordCallInput): Promise<void>;
}

export interface RecordCallInput {
  readonly userId: string;
  readonly endpoint: string;
  readonly status: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUsd: number;
}

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const THIRTY_DAYS_SECONDS = 30 * DAY_SECONDS;

const DEFAULT_HOURLY_LIMIT = 10;
const DEFAULT_DAILY_LIMIT = 30;
const DEFAULT_MONTHLY_TOKEN_BUDGET = 500_000;

function readEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

// Module-level singleton so the default arg of `enforceLimits` doesn't
// re-instantiate on every call. Production handlers should still pass the
// store explicitly so they can share it with the post-Anthropic recordCall
// (see api/generate-week.ts).
let cachedDefaultStore: UsageStore | null = null;
function getDefaultStore(): UsageStore {
  if (!cachedDefaultStore) cachedDefaultStore = defaultUsageStore();
  return cachedDefaultStore;
}

/**
 * Enforces per-user rate limits. Resolves silently if all limits are
 * within bounds; throws `RateLimitError` on the first breach (short-circuits
 * — does not check later limits once one fails).
 *
 * Limits:
 * - 10 successful calls per trailing hour (env: RATE_LIMIT_HOURLY)
 * - 30 successful calls per trailing day  (env: RATE_LIMIT_DAILY)
 * - 500_000 tokens per trailing 30 days   (env: TOKEN_BUDGET_MONTHLY)
 *
 * The `store` parameter is injectable for testing; production callers
 * should omit it to use the default Supabase-backed store, OR pass a
 * shared store so the post-call recordCall hits the same instance.
 *
 * Note: this performs up to 3 sequential Supabase round-trips (hourly
 * count → daily count → token sum). Optimise to a single RPC if p95
 * latency becomes a concern.
 */
export async function enforceLimits(
  userId: string,
  store: UsageStore = getDefaultStore(),
): Promise<void> {
  const now = Date.now();
  const hourlyLimit = readEnvInt("RATE_LIMIT_HOURLY", DEFAULT_HOURLY_LIMIT);
  const dailyLimit = readEnvInt("RATE_LIMIT_DAILY", DEFAULT_DAILY_LIMIT);
  const monthlyBudget = readEnvInt(
    "TOKEN_BUDGET_MONTHLY",
    DEFAULT_MONTHLY_TOKEN_BUDGET,
  );

  const oneHourAgo = new Date(now - HOUR_SECONDS * 1000);
  const hourlyCount = await store.countSuccessfulCalls(userId, oneHourAgo);
  if (hourlyCount >= hourlyLimit) {
    throw new RateLimitError("hourly", HOUR_SECONDS);
  }

  const oneDayAgo = new Date(now - DAY_SECONDS * 1000);
  const dailyCount = await store.countSuccessfulCalls(userId, oneDayAgo);
  if (dailyCount >= dailyLimit) {
    throw new RateLimitError("daily", DAY_SECONDS);
  }

  const thirtyDaysAgo = new Date(now - THIRTY_DAYS_SECONDS * 1000);
  const tokenSum = await store.sumTokens(userId, thirtyDaysAgo);
  if (tokenSum >= monthlyBudget) {
    throw new RateLimitError("monthly_tokens", THIRTY_DAYS_SECONDS);
  }
}

/**
 * Default Supabase-backed implementation of UsageStore. Each call
 * instantiates a thin object that wraps the shared admin client.
 */
export function defaultUsageStore(): UsageStore {
  return {
    async countSuccessfulCalls(userId, since) {
      const client = getAdminClient();
      const { count, error } = await client
        .from("api_usage")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", 200)
        .gte("created_at", since.toISOString());
      if (error) {
        throw new Error(`api_usage count failed: ${error.message}`);
      }
      return count ?? 0;
    },

    async sumTokens(userId, since) {
      // Supabase has no native SUM aggregate over the JS client. For our
      // 30-day window with monthly budgets bounded at ~500K tokens, the
      // row count is small (max ~hundreds), so fetch + reduce in memory.
      // If this becomes hot, replace with an `rpc('sum_tokens_since')`
      // call backed by a SQL function.
      const client = getAdminClient();
      const { data, error } = await client
        .from("api_usage")
        .select("input_tokens, output_tokens")
        .eq("user_id", userId)
        .eq("status", 200)
        .gte("created_at", since.toISOString());
      if (error) {
        throw new Error(`api_usage sum failed: ${error.message}`);
      }
      return (data ?? []).reduce(
        (acc, row) =>
          acc + (row.input_tokens ?? 0) + (row.output_tokens ?? 0),
        0,
      );
    },

    async recordCall(input) {
      const client = getAdminClient();
      const { error } = await client.from("api_usage").insert({
        user_id: input.userId,
        endpoint: input.endpoint,
        status: input.status,
        input_tokens: input.inputTokens,
        output_tokens: input.outputTokens,
        cost_usd: input.costUsd,
      });
      if (error) {
        throw new Error(`api_usage insert failed: ${error.message}`);
      }
    },
  };
}
