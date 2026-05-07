// @vitest-environment node
//
// Phase 1.C — server-owned SYSTEM_PROMPT contract tests.
//
// These tests guard the safety lines and the cache invariant. If a future
// edit removes the medical disclaimer or the safetyFlag escape hatch,
// these tests fail before the change ships. If a future edit accidentally
// makes the constant a function or template literal that varies per
// import, the cache hit rate (Phase 1.D) will silently drop — the
// referential-stability test catches that too.

import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../systemPrompt";

describe("SYSTEM_PROMPT", () => {
  it("is a non-empty string of substantial length", () => {
    expect(typeof SYSTEM_PROMPT).toBe("string");
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(500);
  });

  it("contains the safety lines (Phase 1.C.3)", () => {
    expect(SYSTEM_PROMPT).toMatch(/not a medical professional/i);
    expect(SYSTEM_PROMPT).toMatch(/safetyFlag/);
    expect(SYSTEM_PROMPT).toMatch(
      /duration longer than the athlete's stated daily availability/i,
    );
    expect(SYSTEM_PROMPT).toMatch(/disclaimer/i);
    expect(SYSTEM_PROMPT).toMatch(/Not medical advice/i);
  });

  it("documents the JSON output schema (weekNumber / workouts / safetyFlag / disclaimer)", () => {
    expect(SYSTEM_PROMPT).toMatch(/"weekNumber"/);
    expect(SYSTEM_PROMPT).toMatch(/"workouts"/);
    expect(SYSTEM_PROMPT).toMatch(/"safetyFlag"/);
    expect(SYSTEM_PROMPT).toMatch(/"disclaimer"/);
  });

  it("declares the workout-type enum and the discipline-frequency rule", () => {
    expect(SYSTEM_PROMPT).toMatch(/"run"/);
    expect(SYSTEM_PROMPT).toMatch(/"bike"/);
    expect(SYSTEM_PROMPT).toMatch(/"swim"/);
    expect(SYSTEM_PROMPT).toMatch(/"strength"/);
    expect(SYSTEM_PROMPT).toMatch(/"rest"/);
    expect(SYSTEM_PROMPT).toMatch(/2 swim, 2 bike, 2 run/i);
  });

  it("is referentially stable across imports (cache invariant for Phase 1.D)", async () => {
    // A second dynamic import has its own cache slot in the loader, so this
    // genuinely re-evaluates the module shape. Equal strings means the
    // exported value is a constant, not a getter that re-computes.
    const fresh = await import("../systemPrompt");
    expect(fresh.SYSTEM_PROMPT).toBe(SYSTEM_PROMPT);
  });
});
