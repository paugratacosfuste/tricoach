import type { VercelRequest, VercelResponse } from '@vercel/node';
// `.js` extensions are required: package.json has "type": "module" so Node
// ESM strict resolution applies to the deployed function. See LAUNCH_PLAN
// progress log 2026-04-29 for the diagnosis.
import { verifySupabaseJwt, UnauthorizedError } from './_lib/auth.js';
import {
  enforceLimits,
  RateLimitError,
  defaultUsageStore,
} from './_lib/rateLimit.js';
import { computeCostUsd } from './_lib/pricing.js';
import { SYSTEM_PROMPT } from './_lib/systemPrompt.js';

/**
 * Phase 1.C.4 — bound the audit-log column width. Postgres `text` would
 * accept anything; capping in the handler stops a malicious authenticated
 * client from writing megabytes of garbage into `api_usage.prompt_version`.
 * 64 is generous for the `<YYYY-MM-DD>.<n>` format (~12 chars).
 */
const MAX_PROMPT_VERSION_LEN = 64;

/**
 * Phase 1.C.4 (security review HIGH) — strip non-printable bytes from
 * the version string before persisting. `.slice` alone bounds length
 * but not content; null bytes, ANSI escapes, CRLF, and RTL overrides
 * (U+202E) would otherwise reach `api_usage.prompt_version` and pollute
 * downstream log parsers / dashboards.
 */
function sanitizePromptVersion(raw: unknown): string {
    if (typeof raw !== 'string') return 'unknown';
    const cleaned = raw.slice(0, MAX_PROMPT_VERSION_LEN).replace(/[^\x20-\x7E]/g, '');
    return cleaned.length > 0 ? cleaned : 'unknown';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Authenticate
    let user;
    try {
        user = await verifySupabaseJwt(req);
    } catch (err) {
        if (err instanceof UnauthorizedError) {
            return res.status(401).json({ error: 'unauthorized' });
        }
        console.error('Auth check failed:', err);
        return res.status(500).json({ error: 'Server error' });
    }

    // 2. Enforce per-user rate limits + token budget. The same `store`
    // instance is passed to the post-Anthropic recordCall (block 5) so
    // both reads and writes go through the same path — important if a
    // test or future refactor injects a custom store.
    const store = defaultUsageStore();
    try {
        await enforceLimits(user.userId, store);
    } catch (err) {
        if (err instanceof RateLimitError) {
            res.setHeader('Retry-After', err.retryAfterSeconds);
            return res.status(429).json({
                error: 'rate_limit',
                limitType: err.limitType,
                retryAfterSeconds: err.retryAfterSeconds,
            });
        }
        console.error('Rate limit check failed:', err);
        return res.status(500).json({ error: 'Server error' });
    }

    // 3. Validate request body
    //
    // Phase 1.C — body shape is `{ user, promptVersion? }`. Only the
    // dynamic user half crosses the trust boundary; the static
    // SYSTEM_PROMPT lives server-side so an authenticated user can't
    // curl their own safety-bypassing system payload (Phase 1.C
    // code-review HIGH finding). Clients that still send the legacy
    // `{ prompt }` or `{ system, user }` shape get a 400 (internal
    // proxy, no external consumers).
    const { user: userPrompt, promptVersion } = req.body ?? {};
    if (!userPrompt || typeof userPrompt !== 'string') {
        return res.status(400).json({ error: 'user is required and must be a string' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // 4. Call Anthropic
    //
    // Phase 1.C.1 + 1.C.5 — pinned call shape. Static system + dynamic
    // user message in line with Anthropic's caching contract (1.D will add
    // `cache_control` to the system block).
    //
    // Model choice (1.C.5): `claude-sonnet-4-6`. Best current Sonnet at
    // ship date, on the Claude 4.x line. Rollback to
    // `claude-sonnet-4-5-20250929` (previous Sonnet) or
    // `claude-sonnet-4-20250514` (original 4.0 — what 1.B shipped on)
    // by editing this constant; bump `PROMPT_VERSION` in claudeApi.ts so
    // the audit log captures the swap.
    //
    // temperature 0.2 — deterministic-ish output, low variance week-to-week
    // for the same athlete state. Was unset (defaulted to 1.0).
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 8000,
                temperature: 0.2,
                // Server-owned, immutable across requests.
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userPrompt }],
            }),
        });

        const data = (await response.json()) as {
            usage?: { input_tokens?: number; output_tokens?: number };
            [k: string]: unknown;
        };

        if (!response.ok) {
            console.error('Claude API error:', response.status, data);
            return res.status(response.status).json(data);
        }

        // 5. Record successful call in api_usage so the rate limiter sees
        // it on subsequent requests. Failures here log but do not block
        // the response — the user already has their plan.
        const usage = data.usage ?? {};
        const inputTokens = usage.input_tokens ?? 0;
        const outputTokens = usage.output_tokens ?? 0;
        try {
            await store.recordCall({
                userId: user.userId,
                endpoint: 'generate-week',
                status: 200,
                inputTokens,
                outputTokens,
                costUsd: computeCostUsd(inputTokens, outputTokens),
                // Phase 1.C.4 — bounds the audit-log column width and
                // strips control chars / null bytes / RTL overrides.
                promptVersion: sanitizePromptVersion(promptVersion),
            });
        } catch (writeErr) {
            console.error('api_usage recordCall failed (response sent anyway):', writeErr);
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error calling Claude API:', error);
        return res.status(500).json({ error: 'Failed to generate training plan' });
    }
}
