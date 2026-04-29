import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verifySupabaseJwt, UnauthorizedError } from './_lib/auth';
import {
  enforceLimits,
  RateLimitError,
  defaultUsageStore,
} from './_lib/rateLimit';

// Anthropic Sonnet 4 pricing (per 1M tokens). Used to compute cost_usd
// rows for api_usage so future budget tooling can read it directly.
const ANTHROPIC_INPUT_USD_PER_M = 3;
const ANTHROPIC_OUTPUT_USD_PER_M = 15;

function computeCostUsd(inputTokens: number, outputTokens: number): number {
    const cost =
        (inputTokens / 1_000_000) * ANTHROPIC_INPUT_USD_PER_M +
        (outputTokens / 1_000_000) * ANTHROPIC_OUTPUT_USD_PER_M;
    // Round to 6 decimal places to match the api_usage column precision.
    return Math.round(cost * 1_000_000) / 1_000_000;
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
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required and must be a string' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
        console.error('ANTHROPIC_API_KEY is not set in environment variables');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // 4. Call Anthropic
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 8000,
                messages: [{ role: 'user', content: prompt }],
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Claude API error:', response.status, data);
            return res.status(response.status).json(data);
        }

        // 5. Record successful call in api_usage so the rate limiter sees
        // it on subsequent requests. Failures here log but do not block
        // the response — the user already has their plan.
        const usage = (data?.usage ?? {}) as {
            input_tokens?: number;
            output_tokens?: number;
        };
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
