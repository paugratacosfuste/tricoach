/**
 * Anthropic pricing — Item-11. Centralised so a price change doesn't
 * require a deploy: set `ANTHROPIC_INPUT_USD_PER_M` and
 * `ANTHROPIC_OUTPUT_USD_PER_M` in Vercel env vars and the next request
 * picks up the new rates. Both default to current Sonnet 4 pricing.
 */

const DEFAULT_INPUT_USD_PER_M = 3;
const DEFAULT_OUTPUT_USD_PER_M = 15;

function readPricingEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

export function inputUsdPerMillion(): number {
  return readPricingEnv("ANTHROPIC_INPUT_USD_PER_M", DEFAULT_INPUT_USD_PER_M);
}

export function outputUsdPerMillion(): number {
  return readPricingEnv("ANTHROPIC_OUTPUT_USD_PER_M", DEFAULT_OUTPUT_USD_PER_M);
}

/**
 * Phase 1.D — Anthropic prompt-cache pricing multipliers.
 *
 * Per Anthropic's docs:
 *   - regular `input_tokens`: 1.0× input rate
 *   - `cache_creation_input_tokens` (cache write): 1.25× input rate
 *     (one-time penalty when a fresh cache block is created)
 *   - `cache_read_input_tokens` (cache hit): 0.1× input rate
 *     (the big saving on reused cached content)
 *
 * Multipliers are constant; the per-million $ rate is env-driven via
 * `inputUsdPerMillion()`.
 */
const CACHE_CREATION_INPUT_MULTIPLIER = 1.25;
const CACHE_READ_INPUT_MULTIPLIER = 0.1;

/**
 * Compute the dollar cost of an Anthropic call.
 *
 * @param inputTokens          Regular non-cached input (`usage.input_tokens`).
 * @param outputTokens         Generated output tokens.
 * @param cacheCreationTokens  `usage.cache_creation_input_tokens` — billed
 *   at 1.25× input rate. Defaults to 0 for back-compat with 2-arg callers.
 * @param cacheReadTokens      `usage.cache_read_input_tokens` — billed at
 *   0.1× input rate. Defaults to 0.
 *
 * Rounds to 6 decimal places to match the `api_usage.cost_usd numeric(10,6)`
 * column precision.
 */
export function computeCostUsd(
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number = 0,
  cacheReadTokens: number = 0,
): number {
  const inputRate = inputUsdPerMillion();
  const cost =
    (inputTokens / 1_000_000) * inputRate +
    (outputTokens / 1_000_000) * outputUsdPerMillion() +
    (cacheCreationTokens / 1_000_000) * inputRate * CACHE_CREATION_INPUT_MULTIPLIER +
    (cacheReadTokens / 1_000_000) * inputRate * CACHE_READ_INPUT_MULTIPLIER;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
