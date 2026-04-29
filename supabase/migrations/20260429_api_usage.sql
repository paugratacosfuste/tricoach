-- Phase 1.B — per-user rate limit + token budget + audit log surface.
-- Apply via Supabase Studio → SQL Editor (manual step; see LAUNCH_PLAN
-- §Phase 1.B handoff).
--
-- Columns explained:
--   user_id            FK to auth.users; cascade-deletes if a user account
--                      is removed (GDPR + account-deletion in Phase 3.C).
--   endpoint           Which serverless route logged the call. For Phase
--                      1.B this is always 'generate-week'; future Anthropic
--                      endpoints (coaching chat, weekly summary) will share
--                      the table.
--   status             HTTP status returned by Anthropic (200 = success).
--                      The rate limiter counts only status = 200 rows.
--   input_tokens,
--   output_tokens      From Anthropic's usage object on a 200 response.
--                      The token budget sums these over the trailing 30d.
--   cost_usd           Pre-computed at write time using current Anthropic
--                      Sonnet 4 pricing ($3/M input, $15/M output). Used
--                      by Phase 5.C cost dashboard + alert.
--   prompt_hash,
--   prompt_version,
--   cache_read_tokens,
--   error_class,
--   latency_ms,
--   week_number        Reserved for Phase 1.C (prompt versioning),
--                      Phase 1.D (caching), Phase 1.G (full audit).
--                      Nullable — Phase 1.B does not populate them.

create table if not exists api_usage (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  endpoint            text not null,
  week_number         int,
  prompt_version      text,
  prompt_hash         text,
  input_tokens        int default 0,
  output_tokens       int default 0,
  cache_read_tokens   int default 0,
  cost_usd            numeric(10,6) default 0,
  status              int,
  error_class         text,
  latency_ms          int,
  created_at          timestamptz default now()
);

-- Hot read path: rate limiter queries by (user_id, created_at >= since).
create index if not exists api_usage_user_created_idx
  on api_usage (user_id, created_at desc);

alter table api_usage enable row level security;

-- Users can read their own rows (useful for a future "your usage" UI).
-- All inserts go through the service-role client in api/_lib/rateLimit.ts;
-- there is no INSERT policy, so anon/authenticated roles cannot write.
-- `drop policy if exists` makes this migration idempotent — `create policy`
-- on its own is not.
drop policy if exists "users see their own usage" on api_usage;
create policy "users see their own usage"
  on api_usage for select
  using (auth.uid() = user_id);
