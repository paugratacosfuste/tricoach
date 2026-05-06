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
 * Compute the dollar cost of an Anthropic call given input + output token
 * counts. Rounds to 6 decimal places to match the precision of the
 * `api_usage.cost_usd numeric(10,6)` column.
 */
export function computeCostUsd(inputTokens: number, outputTokens: number): number {
  const cost =
    (inputTokens / 1_000_000) * inputUsdPerMillion() +
    (outputTokens / 1_000_000) * outputUsdPerMillion();
  return Math.round(cost * 1_000_000) / 1_000_000;
}
