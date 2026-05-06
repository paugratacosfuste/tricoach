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
