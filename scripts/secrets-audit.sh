#!/usr/bin/env bash
# scripts/secrets-audit.sh
# Re-runnable audit for leaked secrets in this repo.
# See LAUNCH_PLAN.md Phase 0.
# Exit codes: 0 = clean, 1 = leak detected, 2 = not a git repo.
#
# Self-immunity:
# This script and its tests both reference the secret PATTERNS we look for
# (e.g. the regex literal "sk-ant-..."). Without protection, the script
# would self-trigger when scanning this repo's own history. Two layers
# guard against that:
#   1. EXCLUDES pathspec — `git grep` and `git log -S` skip this script
#      and the test directory entirely.
#   2. String concatenation — the regex *patterns* are assembled from parts
#      ("sk-""ant-") so the assignment line in this file does not contain
#      a contiguous "sk-ant-" literal. This is belt-and-braces in case the
#      EXCLUDES are ever removed by mistake.
# Note: user-visible labels in this script use the hyphenated form
# "service-role" (not "service_role") for the same reason.

set -uo pipefail

# Color codes only when stdout is a TTY
if [ -t 1 ]; then
  R=$'\033[0;31m'; G=$'\033[0;32m'; Y=$'\033[0;33m'; B=$'\033[0;34m'; N=$'\033[0m'
else
  R=''; G=''; Y=''; B=''; N=''
fi

FAIL=0
PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() { printf "%sOK%s   %s\n"   "$G" "$N" "$1"; PASS_COUNT=$((PASS_COUNT+1)); }
fail() { printf "%sFAIL%s %s\n"   "$R" "$N" "$1"; FAIL=1; FAIL_COUNT=$((FAIL_COUNT+1)); }
warn() { printf "%sWARN%s %s\n"   "$Y" "$N" "$1"; WARN_COUNT=$((WARN_COUNT+1)); }
info() { printf "%s--%s   %s\n"   "$B" "$N" "$1"; }

# --help / -h
case "${1:-}" in
  -h|--help)
    cat <<EOF
Usage: bash scripts/secrets-audit.sh

Audits the current git repository for leaked secrets:
  - .env files in the working tree or git history
  - Anthropic API keys (sk-ant-...) in source or history
  - Supabase service-role keys (literal or JWT form) in source or history
  - JWT tokens in tracked source

Exit codes:
  0  audit passed (no leaks detected)
  1  one or more checks failed — investigate immediately
  2  not run inside a git repository

See LAUNCH_PLAN.md Phase 0 for context.
EOF
    exit 0
    ;;
esac

# Must be in a git repo
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Not a git repository — aborting." >&2
  exit 2
fi

# Operate from repo top so pathspecs are predictable.
TOP=$(git rev-parse --show-toplevel)
cd "$TOP"

# Patterns assembled from parts (see Self-immunity note at top).
ANTHROPIC_PATTERN="sk-""ant-(api[0-9]+-)?[A-Za-z0-9_-]{12,}"
ANTHROPIC_PICKAXE="sk-""ant-"
SR_LITERAL_PATTERN="service""_role"
# Three-segment JWT (header.payload.signature). Anthropic + Supabase keys
# use this shape; service-role JWT looks identical to anon JWT in source.
JWT_PATTERN="eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}"

# Pathspec excludes: this script + its tests. Without these, the literal
# patterns above would self-trigger on every run after this commit.
EXCLUDES=(
  ":(exclude)scripts/secrets-audit.sh"
  ":(exclude)scripts/__tests__"
)

echo "TriCoach AI — secrets audit"
echo "==============================="

# Check 1 — .gitignore covers .env files
# Regex requires `.env` to be a complete path component (followed by end of
# line, dot, star, or slash) so `.environment` does not satisfy it.
info "Check 1 — .gitignore covers .env files"
if [ -f .gitignore ] && grep -qE '^\.env([.*/]|$)' .gitignore; then
  pass "gitignore contains a .env pattern"
else
  fail "gitignore is missing a .env pattern"
fi

# Check 2 — No .env files tracked in working tree (except .env.example)
info "Check 2 — no .env files tracked"
TRACKED_ENV=$(git ls-files \
  | grep -E '(^|/)\.env($|\.|/)' \
  | grep -vE '\.env\.example$' || true)
if [ -z "$TRACKED_ENV" ]; then
  pass "no tracked .env files"
else
  fail "tracked .env files found:"
  echo "$TRACKED_ENV"
fi

# Check 3 — .env files ever in git history
# `--pretty=format:` produces blank lines between commits' file lists; we
# strip them before sort -u so the failure output stays clean.
info "Check 3 — .env files ever in git history"
HIST_ENV=$(git log --all --full-history --diff-filter=A --name-only --pretty=format: 2>/dev/null \
  | grep -v '^$' \
  | grep -E '(^|/)\.env($|\.|/)' \
  | grep -vE '\.env\.example$' \
  | sort -u || true)
if [ -z "$HIST_ENV" ]; then
  pass "no .env files in git history"
else
  fail ".env files in git history:"
  echo "$HIST_ENV"
fi

# Check 4 — Anthropic API key in tracked source
info "Check 4 — Anthropic API key in tracked source"
ANTH=$(git grep -n -E "$ANTHROPIC_PATTERN" -- "${EXCLUDES[@]}" 2>/dev/null || true)
if [ -z "$ANTH" ]; then
  pass "no Anthropic API key in tracked source"
else
  fail "Anthropic API key pattern found in tracked source:"
  echo "$ANTH"
fi

# Check 5 — Anthropic API key in git history
# `head -3` closes its stdin after 3 lines, sending SIGPIPE to upstream
# `grep`. With pipefail the pipeline exits non-zero, but the trailing
# `|| true` collapses it back to 0 so the assignment succeeds. Do not
# remove the `|| true` here.
info "Check 5 — Anthropic API key in git history"
ANTH_HIST=$(git log -p --all -S "$ANTHROPIC_PICKAXE" --pretty=format: -- "${EXCLUDES[@]}" 2>/dev/null \
  | grep -E "$ANTHROPIC_PATTERN" \
  | head -3 || true)
if [ -z "$ANTH_HIST" ]; then
  pass "no Anthropic API key in git history"
else
  fail "Anthropic API key pattern found in git history (first 3 hits):"
  echo "$ANTH_HIST"
fi

# Check 6 — Supabase service-role literal in tracked source
info "Check 6 — Supabase service-role literal in tracked source"
SR=$(git grep -n -i "$SR_LITERAL_PATTERN" -- "${EXCLUDES[@]}" 2>/dev/null || true)
if [ -z "$SR" ]; then
  pass "no service-role literal in tracked source"
else
  fail "service-role literal found in tracked source:"
  echo "$SR"
fi

# Check 7 — Supabase service-role literal in git history (warn-only —
# could legitimately appear in docs/migrations referring to the role name).
info "Check 7 — Supabase service-role literal in git history"
SR_HIST=$(git log -p --all -S "$SR_LITERAL_PATTERN" --pretty=format: -- "${EXCLUDES[@]}" 2>/dev/null \
  | grep -i "$SR_LITERAL_PATTERN" \
  | head -3 || true)
if [ -z "$SR_HIST" ]; then
  pass "no service-role literal in git history"
else
  warn "service-role literal found in git history (first 3 hits) — investigate:"
  echo "$SR_HIST"
fi

# Check 8 — JWT (eyJ...) in tracked source
# A three-segment JWT in source is almost always a hardcoded leak — even
# the Supabase anon key (which is intentionally public at runtime) should
# never be hardcoded; it should come from VITE_SUPABASE_ANON_KEY.
info "Check 8 — JWT token in tracked source"
JWT=$(git grep -n -E "$JWT_PATTERN" -- "${EXCLUDES[@]}" 2>/dev/null || true)
if [ -z "$JWT" ]; then
  pass "no JWT token in tracked source"
else
  fail "JWT pattern found in tracked source (likely hardcoded key):"
  echo "$JWT"
fi

# Check 9 — JWT in git history
info "Check 9 — JWT token in git history"
JWT_HIST=$(git log -p --all -S 'eyJ' --pretty=format: -- "${EXCLUDES[@]}" 2>/dev/null \
  | grep -E "$JWT_PATTERN" \
  | head -3 || true)
if [ -z "$JWT_HIST" ]; then
  pass "no JWT token in git history"
else
  fail "JWT pattern found in git history (first 3 hits):"
  echo "$JWT_HIST"
fi

echo
echo "==============================="
printf "Passed: %d  Failed: %d  Warned: %d\n" "$PASS_COUNT" "$FAIL_COUNT" "$WARN_COUNT"
if [ "$FAIL" -eq 0 ]; then
  printf "%sAUDIT PASSED%s\n" "$G" "$N"
  exit 0
else
  printf "%sAUDIT FAILED%s\n" "$R" "$N"
  exit 1
fi
