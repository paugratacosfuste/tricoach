// @vitest-environment node

import { describe, it, expect, beforeEach } from "vitest";
import {
  inputUsdPerMillion,
  outputUsdPerMillion,
  computeCostUsd,
} from "../pricing";

describe("pricing — env-driven Anthropic rates (Item-11)", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_INPUT_USD_PER_M;
    delete process.env.ANTHROPIC_OUTPUT_USD_PER_M;
  });

  it("returns Sonnet defaults when env vars are unset (input=$3/M, output=$15/M)", () => {
    expect(inputUsdPerMillion()).toBe(3);
    expect(outputUsdPerMillion()).toBe(15);
  });

  it("respects ANTHROPIC_INPUT_USD_PER_M when set (handles fractional pricing)", () => {
    process.env.ANTHROPIC_INPUT_USD_PER_M = "0.8";
    expect(inputUsdPerMillion()).toBe(0.8);
  });

  it("respects ANTHROPIC_OUTPUT_USD_PER_M when set", () => {
    process.env.ANTHROPIC_OUTPUT_USD_PER_M = "4.0";
    expect(outputUsdPerMillion()).toBe(4.0);
  });

  it("falls back to default when env value is non-numeric", () => {
    process.env.ANTHROPIC_INPUT_USD_PER_M = "not-a-number";
    expect(inputUsdPerMillion()).toBe(3);
  });

  it("falls back to default when env value is negative", () => {
    process.env.ANTHROPIC_INPUT_USD_PER_M = "-1";
    expect(inputUsdPerMillion()).toBe(3);
  });

  it("computeCostUsd rounds to 6 decimals (matches api_usage.cost_usd numeric(10,6))", () => {
    // 1000 input tokens × $3/M + 2000 output × $15/M = 0.003 + 0.030 = 0.033
    expect(computeCostUsd(1000, 2000)).toBe(0.033);
  });

  it("computeCostUsd respects env overrides", () => {
    process.env.ANTHROPIC_INPUT_USD_PER_M = "1";
    process.env.ANTHROPIC_OUTPUT_USD_PER_M = "5";
    // 1_000_000 input × $1 + 1_000_000 output × $5 = $6
    expect(computeCostUsd(1_000_000, 1_000_000)).toBe(6);
  });
});

// ============================================
// Phase 1.D — prompt-cache pricing
// ============================================
//
// Anthropic's cache pricing has three tiers per Anthropic's docs:
//   - regular `input_tokens`: 1.0× input rate
//   - `cache_creation_input_tokens` (write): 1.25× input rate (one-time
//     penalty when a fresh cache block is created)
//   - `cache_read_input_tokens` (hit): 0.1× input rate (huge discount on
//     reused cached content)
// Output pricing is unaffected.
//
// `computeCostUsd` therefore takes 4 args. Existing 2-arg callers behave
// the same because `cacheCreationTokens` and `cacheReadTokens` default to 0.

describe("computeCostUsd — Phase 1.D cache-aware pricing", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_INPUT_USD_PER_M;
    delete process.env.ANTHROPIC_OUTPUT_USD_PER_M;
  });

  it("backwards-compatible: 2-arg call returns the same number as before (no cache args)", () => {
    expect(computeCostUsd(1000, 2000)).toBe(0.033);
  });

  it("cache_creation_input_tokens is billed at 1.25× the input rate", () => {
    // 1000 cache-creation tokens × $3/M × 1.25 = 0.00375
    expect(computeCostUsd(0, 0, 1000, 0)).toBeCloseTo(0.00375, 6);
  });

  it("cache_read_input_tokens is billed at 0.1× the input rate (the big saving)", () => {
    // 10_000 cache-read tokens × $3/M × 0.1 = 0.003
    expect(computeCostUsd(0, 0, 0, 10_000)).toBeCloseTo(0.003, 6);
  });

  it("combines all four token types correctly", () => {
    // 1000 input × $3/M × 1.0   = 0.003
    // 2000 output × $15/M × 1.0 = 0.030
    //  500 create × $3/M × 1.25 = 0.001875
    // 5000 read   × $3/M × 0.1  = 0.0015
    // total = 0.036375
    expect(computeCostUsd(1000, 2000, 500, 5000)).toBeCloseTo(0.036375, 6);
  });

  it("cache-read 70%-hit scenario yields ~70% discount on cached portion vs. all-fresh equivalent", () => {
    // Scenario: 10K-token static system prompt; second call sees it cached.
    const allFresh = computeCostUsd(10_000, 0, 0, 0);
    const cachedHit = computeCostUsd(0, 0, 0, 10_000);
    // Cache read is 0.1× regular input; so the saving = 0.9 of the original cost.
    expect(cachedHit).toBeCloseTo(allFresh * 0.1, 6);
    expect(cachedHit / allFresh).toBeCloseTo(0.1, 4);
  });

  it("respects env overrides on cache pricing too (multipliers stay constant)", () => {
    process.env.ANTHROPIC_INPUT_USD_PER_M = "10";
    // 1000 cache-create × $10/M × 1.25 = 0.0125
    expect(computeCostUsd(0, 0, 1000, 0)).toBeCloseTo(0.0125, 6);
    // 1000 cache-read × $10/M × 0.1 = 0.001
    expect(computeCostUsd(0, 0, 0, 1000)).toBeCloseTo(0.001, 6);
  });
});
