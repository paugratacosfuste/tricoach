// @vitest-environment node

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(process.cwd(), "scripts", "secrets-audit.sh");

// Fixture literals are built from string concatenation so this test file's
// own source does NOT contain a contiguous "sk-ant-" or "service_role"
// literal — which would otherwise self-trigger the audit when this file is
// committed and the audit runs against this repo's history.
const FAKE_ANTHROPIC_KEY = "sk-" + "ant-" + "api03-FAKEFAKEFAKEFAKEFAKEFAKE";
const FAKE_SERVICE_ROLE = "service" + "_role" + "_eyJhbGciOiJIUzI1NiJ9";
const SERVICE_ROLE_RE = new RegExp("service" + "_role", "i");

interface RunResult {
  readonly code: number;
  readonly out: string;
}

function makeTempRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "secrets-audit-test-"));
  execSync("git init -q", { cwd: dir });
  execSync("git config user.email t@t", { cwd: dir });
  execSync("git config user.name t", { cwd: dir });
  // baseline gitignore — covers .env files
  writeFileSync(join(dir, ".gitignore"), ".env\n.env.local\n.env.*\n");
  execSync("git add .gitignore", { cwd: dir });
  execSync("git commit -q -m init", { cwd: dir });
  return dir;
}

function commit(dir: string, message: string): void {
  execSync("git add -A", { cwd: dir });
  // JSON.stringify produces a properly-escaped double-quoted string,
  // safe to interpolate into a shell command line.
  execSync(`git commit -q -m ${JSON.stringify(message)}`, { cwd: dir });
}

function run(dir: string): RunResult {
  try {
    const out = execSync(`bash "${SCRIPT}"`, {
      cwd: dir,
      encoding: "utf8",
    });
    return { code: 0, out };
  } catch (e: unknown) {
    const err = e as {
      status?: number;
      stdout?: Buffer | string;
      stderr?: Buffer | string;
    };
    const code = err.status ?? 1;
    const out = String(err.stdout ?? "") + String(err.stderr ?? "");
    return { code, out };
  }
}

describe("scripts/secrets-audit.sh", () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTempRepo();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("passes on a clean repo with no leaked secrets", () => {
    const result = run(dir);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/AUDIT PASSED/);
  });

  it("fails when an Anthropic API key is committed in tracked source", () => {
    writeFileSync(join(dir, "leak.ts"), `const k = "${FAKE_ANTHROPIC_KEY}";\n`);
    commit(dir, "leak");
    const result = run(dir);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/Anthropic/i);
  });

  it("fails when an .env file is force-committed and tracked", () => {
    writeFileSync(join(dir, ".env"), "ANTHROPIC_API_KEY=sk-ant-fake\n");
    execSync("git add -f .env", { cwd: dir });
    execSync("git commit -q -m leak", { cwd: dir });
    const result = run(dir);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/\.env/);
  });

  it("fails when service_role appears in tracked source", () => {
    writeFileSync(join(dir, "config.ts"), `const k = "${FAKE_SERVICE_ROLE}";\n`);
    commit(dir, "leak");
    const result = run(dir);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(SERVICE_ROLE_RE);
  });

  it("fails when .gitignore is missing the .env pattern", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\n");
    commit(dir, "weaken gitignore");
    const result = run(dir);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/gitignore/i);
  });

  it("fails when a JWT-shaped token is committed in tracked source", () => {
    // Three-segment JWT-like blob (header.payload.signature). Includes
    // the literal "eyJ" so the pickaxe -S sees it; the per-segment regex
    // requires ≥10 chars in each segment.
    const fakeJwt =
      "eyJhbGciOiJIUzI1NiJ9" +
      "." +
      "eyJzdWIiOiIxMjM0NTY3ODkwIn0" +
      "." +
      "FAKEFAKEFAKESIGNATURE";
    writeFileSync(join(dir, "config.ts"), `const k = "${fakeJwt}";\n`);
    commit(dir, "leak");
    const result = run(dir);
    expect(result.code).toBe(1);
    expect(result.out).toMatch(/JWT/i);
  });

  it("does not false-positive when a key appears only in scripts/__tests__/ (excluded)", () => {
    // Simulates this repo's actual situation post-commit: the test file
    // contains fixture keys, and the audit script contains regex literals,
    // both inside the EXCLUDES pathspec. A real commit will also touch
    // non-excluded files (vitest.config.ts, README.md), so we mimic that.
    mkdirSync(join(dir, "scripts", "__tests__"), { recursive: true });
    writeFileSync(
      join(dir, "scripts", "__tests__", "fixture.ts"),
      `const k = "${FAKE_ANTHROPIC_KEY}"; const r = "${FAKE_SERVICE_ROLE}";\n`,
    );
    writeFileSync(join(dir, "README.md"), "hello\n");
    commit(dir, "fixture in tests dir alongside non-excluded readme");
    const result = run(dir);
    expect(result.code).toBe(0);
    expect(result.out).toMatch(/AUDIT PASSED/);
  });

  it("exits 2 when run outside a git repository", () => {
    const nonRepo = mkdtempSync(join(tmpdir(), "secrets-audit-nogit-"));
    try {
      const result = run(nonRepo);
      expect(result.code).toBe(2);
    } finally {
      rmSync(nonRepo, { recursive: true, force: true });
    }
  });
});
