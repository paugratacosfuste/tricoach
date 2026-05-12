// src/lib/sanitize.ts
//
// Phase 1.E — single chokepoint for athlete-supplied free-text fields
// before they cross into the Claude prompt. Applied in `buildWeekPrompt`
// (and `buildHistoryContext`) at every interpolation site for:
// - `goal.raceName`
// - `goal.goalTime`
// - `feedback.notes`
// - each `feedback.physicalIssues[i]`
// - `nextWeekConstraints`
// - `profile.firstName`
// - all string fields in `fitness` (defence-in-depth pre-Phase-3 Zod)
//
// CONTRACT (locked in by `sanitize.test.ts`):
// - Pure, deterministic, idempotent.
// - Never throws — coerces non-string input to `''`.
// - Strips: backticks, script/iframe/style tags, Unicode bidi controls,
//   BOM, C0 control chars (except \t and \n).
// - Collapses runs of newlines to a single `\n` so an attacker can't
//   forge a new `## SECTION` block in the middle of an athlete field.
// - Caps length at `maxLen` (default 500), measured in Unicode code
//   points so an emoji at the boundary is never split mid-surrogate.
//
// NON-GOALS:
// - Not an HTML sanitizer. Output is for Anthropic, not a browser. We
//   strip `<script|iframe|style>` because those are the highest-signal
//   prompt-injection markers, not because the output is rendered. Other
//   tags (`<svg onload=...>`, `<object>`, `<embed>`) are not stripped:
//   the threat model is prompt injection, not XSS.
// - Not a profanity filter; not a PII scrubber.

const DEFAULT_MAX_LEN = 500;

// Tags whose presence indicates a prompt-injection / smuggling attempt.
// Strip the entire tag (including angle brackets) to minimise structural
// signal in the sanitised output.
const DANGEROUS_TAG_RE = /<\/?(script|iframe|style)[^>]*>/gi;

// Unicode bidi controls + BOM. These are invisible characters that can
// reorder displayed text or hide payloads from human review.
//   U+202A LEFT-TO-RIGHT EMBEDDING        (LRE)
//   U+202B RIGHT-TO-LEFT EMBEDDING        (RLE)
//   U+202C POP DIRECTIONAL FORMATTING     (PDF)
//   U+202D LEFT-TO-RIGHT OVERRIDE         (LRO)
//   U+202E RIGHT-TO-LEFT OVERRIDE         (RLO)
//   U+2066 LEFT-TO-RIGHT ISOLATE          (LRI)
//   U+2067 RIGHT-TO-LEFT ISOLATE          (RLI)
//   U+2068 FIRST STRONG ISOLATE           (FSI)
//   U+2069 POP DIRECTIONAL ISOLATE        (PDI)
//   U+FEFF ZERO WIDTH NO-BREAK SPACE      (BOM)
//
// `\u` escapes (not literal codepoints) so the regex stays readable in
// editors and survives "clean up whitespace" formatters that would
// silently strip or re-order invisible characters in a literal class.
const BIDI_OR_BOM_RE = /[\u202A-\u202E\u2066-\u2069\uFEFF]/g;

// C0 control characters (0x00–0x1F) and DEL (0x7F), EXCEPT \t (0x09) and
// \n (0x0A) which are legitimate whitespace inside a free-text field.
const CONTROL_CHAR_RE = /[\x00-\x08\x0B-\x1F\x7F]/g;

// Two-or-more consecutive newlines collapsed to a single `\n`. Stops an
// attacker from forging the visual break between prompt sections.
const MULTI_NEWLINE_RE = /\n{2,}/g;

/**
 * Sanitise a free-text athlete input before interpolating it into the
 * Claude user-message prompt. See module header for the full contract.
 *
 * @param raw    The raw input. Non-string values coerce to `''`.
 * @param maxLen Maximum length after sanitisation (counted in Unicode
 *   code points, not UTF-16 units, so a surrogate pair at the boundary
 *   is preserved or removed as a unit). Default 500.
 */
export function sanitizePromptInput(
  raw: unknown,
  maxLen: number = DEFAULT_MAX_LEN,
): string {
  if (typeof raw !== 'string') return '';

  let cleaned = raw;
  cleaned = cleaned.replace(DANGEROUS_TAG_RE, '');
  cleaned = cleaned.replace(BIDI_OR_BOM_RE, '');
  cleaned = cleaned.replace(CONTROL_CHAR_RE, '');
  cleaned = cleaned.replace(/`/g, '');
  cleaned = cleaned.replace(MULTI_NEWLINE_RE, '\n');
  cleaned = cleaned.trim();

  // Codepoint-aware truncation. `String.prototype.slice` operates on
  // UTF-16 code units and would split a surrogate pair (e.g. an emoji)
  // mid-codepoint, producing a lone surrogate. Spreading into an array
  // iterates by codepoint.
  const codepoints = [...cleaned];
  if (codepoints.length > maxLen) {
    cleaned = codepoints.slice(0, maxLen).join('');
  }

  return cleaned;
}
