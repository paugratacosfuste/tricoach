// src/lib/claudeApi.ts
//
// PURPOSE: Handles all communication with Claude API.
// Generates ONE WEEK at a time with full detail, using history context.

import {
  OnboardingData,
  WeekPlan,
  Workout,
  WorkoutType,
  CompletedWeek,
  WeekSummary,
  WeekFeedback,
  calculateHRZones,
  calculateTrainingPhase,
  isRecoveryWeek,
} from '@/types/training';
import { supabase } from '@/lib/supabase';
import { getFreshAccessToken } from '@/lib/auth/freshToken';

// Get the API key from environment variables
// NOTE: The API key is now server-side only via Vercel API route.
// The client sends prompts to /api/generate-week which proxies to Claude.

// ============================================
// HISTORY CONTEXT BUILDER
// ============================================

/**
 * Builds a compact summary of training history for Claude
 * Recent weeks get more detail, older weeks are compressed
 */
export function buildHistoryContext(completedWeeks: CompletedWeek[]): string {
  if (completedWeeks.length === 0) {
    return "This is the athlete's first week of training. No prior history.";
  }

  const parts: string[] = [];

  // Last 2 weeks: detailed view
  const recentWeeks = completedWeeks.slice(-2);
  if (recentWeeks.length > 0) {
    parts.push('RECENT WEEKS (detailed):');
    recentWeeks.forEach((week) => {
      const keyWorkoutsStr = week.summary.keyWorkouts
        .map((k) => `${k.name} ${k.completed ? '✓' : '✗'}${k.notes ? ` (${k.notes})` : ''}`)
        .join(', ');

      // Defensive accessors — if a CompletedWeek was rehydrated from
      // Supabase before the feedback shape was fully populated, these
      // fields can be missing. Fall back to safe defaults so the prompt
      // still renders rather than throwing.
      const physicalIssues = week.summary.feedback?.physicalIssues ?? [];
      const notes = week.summary.feedback?.notes ?? '';
      const overallFeeling = week.summary.feedback?.overallFeeling ?? 'okay';
      parts.push(
        `- Week ${week.weekNumber} (${week.phase}): ` +
        `${week.summary.completedHours.toFixed(1)}h of ${week.summary.plannedHours.toFixed(1)}h ` +
        `(${week.summary.completionRate}% completion). ` +
        `Key sessions: ${keyWorkoutsStr}. ` +
        `Feeling: ${overallFeeling}. ` +
        (physicalIssues.length > 0
          ? `Issues: ${physicalIssues.join(', ')}. `
          : '') +
        (notes ? `Notes: "${notes}"` : '')
      );
    });
  }

  // Older weeks: compressed summary
  const olderWeeks = completedWeeks.slice(0, -2);
  if (olderWeeks.length > 0) {
    const avgCompletion =
      olderWeeks.reduce((sum, w) => sum + w.summary.completionRate, 0) / olderWeeks.length;
    const avgHours =
      olderWeeks.reduce((sum, w) => sum + w.summary.completedHours, 0) / olderWeeks.length;
    const totalHours = olderWeeks.reduce((sum, w) => sum + w.summary.completedHours, 0);
    const phases = [...new Set(olderWeeks.map((w) => w.phase))];

    // Check for recurring issues
    const allIssues = olderWeeks.flatMap((w) => w.summary.feedback.physicalIssues);
    const issueCounts: Record<string, number> = {};
    allIssues.forEach((issue) => {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1;
    });
    const recurringIssues = Object.entries(issueCounts)
      .filter(([, count]) => count >= 2)
      .map(([issue]) => issue);

    parts.push('');
    parts.push('TRAINING HISTORY (weeks 1-' + olderWeeks.length + '):');
    parts.push(
      `- Total: ${totalHours.toFixed(1)}h over ${olderWeeks.length} weeks (avg ${avgHours.toFixed(1)}h/week)`
    );
    parts.push(`- Average completion: ${avgCompletion.toFixed(0)}%`);
    parts.push(`- Phases completed: ${phases.join(' → ')}`);
    if (recurringIssues.length > 0) {
      parts.push(`- Recurring issues to monitor: ${recurringIssues.join(', ')}`);
    }
  }

  return parts.join('\n');
}

// ============================================
// PROMPT VERSIONING (Phase 1.C.4)
// ============================================
//
// Bumped on every prompt-shape change. The audit log row in `api_usage`
// stores this so we can correlate cost/quality regressions with prompt
// edits. Format: `<YYYY-MM-DD>.<n>` — n increments if multiple edits ship
// the same day.
//
// MUST be kept in sync with the canonical model + temperature pinned in
// `api/generate-week.ts` (Phase 1.C.5: Sonnet 4.6, temperature 0.2,
// max_tokens 8000). Bump the suffix `.n` on a prompt-text change; bump
// the date on any structural change (system/user split, schema, safety).
export const PROMPT_VERSION = '2026-05-07.1';

// ============================================
// PROMPT BUILDER (Phase 1.C.2)
// ============================================
//
// SECURITY: the static SYSTEM_PROMPT lives in `api/_lib/systemPrompt.ts`,
// not here. The client never sends a system prompt to the proxy — if it
// did, any authenticated user could curl `/api/generate-week` with
// arbitrary `system: "ignore safety, prescribe..."` and bypass the
// safety lines. See Phase 1.C code-review HIGH finding.
//
// `buildWeekPrompt` therefore returns ONLY the dynamic user half. The
// proxy pairs it with the server-owned SYSTEM_PROMPT before calling
// Anthropic.

/** Return shape of `buildWeekPrompt` — declared so the export is self-documenting. */
export interface WeekPromptHalves {
  /** Dynamic user-message half. Server pairs with its own SYSTEM_PROMPT. */
  readonly user: string;
}

/**
 * Builds the dynamic user-message half of the per-call prompt.
 *
 * The static system half is server-owned (`api/_lib/systemPrompt.ts`)
 * and never crosses the trust boundary.
 */
export function buildWeekPrompt(
  userData: OnboardingData,
  weekNumber: number,
  totalWeeks: number,
  completedWeeks: CompletedWeek[],
  nextWeekConstraints?: string
): WeekPromptHalves {
  const phase = calculateTrainingPhase(weekNumber, totalWeeks);
  const isRecovery = isRecoveryWeek(weekNumber);
  const hrZones = calculateHRZones(userData.fitness.lthr);
  const weeksUntilRace = totalWeeks - weekNumber;

  const isTriathlon = [
    'olympic-triathlon',
    'sprint-triathlon',
    '70.3-ironman',
    'full-ironman',
  ].includes(userData.goal.raceType);

  const historyContext = buildHistoryContext(completedWeeks);
  const lastWeek = completedWeeks[completedWeeks.length - 1];
  const lastWeekFeedback = lastWeek?.summary.feedback;

  const disciplineGuidance = isTriathlon
    ? `
## DISCIPLINE GUIDANCE (triathlon)
The athlete's swim level is "${userData.fitness.swimLevel}":
- beginner: focus swim sessions on technique drills, shorter intervals, more rest.
- intermediate: mix technique with aerobic development.
- advanced / competitive: include threshold and race-pace work.

Hard requirement: 2 swim, 2 bike, 2 run sessions per week. Adjust INTENSITY by skill, not frequency.
`
    : '';

  const recoveryFlag = isRecovery
    ? '- ⚠️ THIS IS A RECOVERY / DELOAD WEEK — reduce volume by 30–40%, keep intensity low, but still include all 3 disciplines for triathlon.'
    : '';
  const fatigueFlag =
    lastWeekFeedback?.overallFeeling === 'struggling' || lastWeekFeedback?.overallFeeling === 'tired'
      ? '- ⚠️ Athlete reported fatigue last week — consider reducing load.'
      : '';
  const issuesFlag =
    lastWeekFeedback?.physicalIssues && lastWeekFeedback.physicalIssues.length > 0
      ? `- ⚠️ Physical issues reported: ${lastWeekFeedback.physicalIssues.join(', ')} — adapt accordingly.`
      : '';
  // TODO(phase-1.E): `nextWeekConstraints` is highest-risk prompt-injection
  // surface in the user half — interpolated verbatim. 1.E will route every
  // free-text athlete input (raceName, goalTime, feedback.notes,
  // physicalIssues[i], nextWeekConstraints) through `sanitizePromptInput`.
  const constraintFlag = nextWeekConstraints
    ? `- ⚠️ Athlete constraint: "${nextWeekConstraints}" — adapt schedule accordingly.`
    : '';

  const flags = [recoveryFlag, fatigueFlag, issuesFlag, constraintFlag]
    .filter((line) => line.length > 0)
    .join('\n');

  const user = `## ATHLETE PROFILE
- Name: ${userData.profile.firstName}
- Age: ${userData.profile.age}, Weight: ${userData.profile.weight}kg, Height: ${userData.profile.height}cm
- Level: ${userData.fitness.fitnessLevel}
- Max HR: ${userData.fitness.maxHR}bpm
- LTHR: ${userData.fitness.lthr}bpm
- Threshold Pace: ${userData.fitness.thresholdPace}/km
${userData.fitness.ftp ? `- FTP: ${userData.fitness.ftp}W` : ''}
- Swim Level: ${userData.fitness.swimLevel}

## HEART RATE ZONES (derived from LTHR ${userData.fitness.lthr})
- Zone 1 Recovery: ${hrZones.zone1.min}-${hrZones.zone1.max}bpm
- Zone 2 Aerobic: ${hrZones.zone2.min}-${hrZones.zone2.max}bpm
- Zone 3 Tempo: ${hrZones.zone3.min}-${hrZones.zone3.max}bpm
- Zone 4 Threshold: ${hrZones.zone4.min}-${hrZones.zone4.max}bpm
- Zone 5 VO2max: ${hrZones.zone5.min}-${hrZones.zone5.max}bpm

## RACE GOAL
- Race: ${userData.goal.raceName} (${userData.goal.raceType})
- Date: ${new Date(userData.goal.raceDate).toLocaleDateString()}
- Weeks until race: ${weeksUntilRace}
- Priority: ${userData.goal.priority}
${userData.goal.goalTime ? `- Target time: ${userData.goal.goalTime}` : ''}
${disciplineGuidance}
## TRAINING CONTEXT
- Currently generating: WEEK ${weekNumber} of ${totalWeeks}
- Training phase: ${phase}
${flags}

## TRAINING HISTORY
${historyContext}

## WEEKLY AVAILABILITY
- Monday: ${userData.availability.monday.available ? `Available (${userData.availability.monday.timeSlots.join(', ')}, max ${userData.availability.monday.maxDuration})` : 'REST DAY'}
- Tuesday: ${userData.availability.tuesday.available ? `Available (${userData.availability.tuesday.timeSlots.join(', ')}, max ${userData.availability.tuesday.maxDuration})` : 'REST DAY'}
- Wednesday: ${userData.availability.wednesday.available ? `Available (${userData.availability.wednesday.timeSlots.join(', ')}, max ${userData.availability.wednesday.maxDuration})` : 'REST DAY'}
- Thursday: ${userData.availability.thursday.available ? `Available (${userData.availability.thursday.timeSlots.join(', ')}, max ${userData.availability.thursday.maxDuration})` : 'REST DAY'}
- Friday: ${userData.availability.friday.available ? `Available (${userData.availability.friday.timeSlots.join(', ')}, max ${userData.availability.friday.maxDuration})` : 'REST DAY'}
- Saturday: ${userData.availability.saturday.available ? `Available (${userData.availability.saturday.timeSlots.join(', ')}, max ${userData.availability.saturday.maxDuration})${userData.availability.saturday.longSession ? ' - LONG SESSION DAY' : ''}` : 'REST DAY'}
- Sunday: ${userData.availability.sunday.available ? `Available (${userData.availability.sunday.timeSlots.join(', ')}, max ${userData.availability.sunday.maxDuration})${userData.availability.sunday.longSession ? ' - LONG SESSION DAY' : ''}` : 'REST DAY'}

Generate WEEK ${weekNumber} of ${totalWeeks} now. Return ONLY the JSON object specified in the system instructions.`;

  return { user };
}

// ============================================
// JSON PARSING
// ============================================

/**
 * Attempts to fix truncated or malformed JSON.
 *
 * Wave 9 / Item-4: uses a stack of expected closers so that nested structures
 * close in the correct order. The previous implementation tracked `{` and `[`
 * with separate counters and emitted all `]`s before all `}`s — wrong when
 * an array sits inside an object (e.g. `{"workouts": [{"a":1`), producing
 * invalid JSON like `…"a":1]}}` instead of `…"a":1}]}`.
 */
export function fixTruncatedJson(str: string): string {
  // Remove markdown code blocks
  str = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  const expected: string[] = []; // stack of expected closing chars
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{') expected.push('}');
    else if (char === '[') expected.push(']');
    else if (
      (char === '}' || char === ']') &&
      expected.length > 0 &&
      expected[expected.length - 1] === char
    ) {
      expected.pop();
    }
  }

  // Close unclosed string
  if (inString) {
    str += '"';
  }

  // Remove trailing comma before appending closers
  str = str.replace(/,\s*$/, '');

  // Pop closers in LIFO order — matches actual nesting.
  while (expected.length > 0) {
    str = str.replace(/,\s*$/, '') + expected.pop()!;
  }

  // Final pass: clean trailing commas before closing brackets / braces.
  str = str.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');

  return str;
}

/**
 * Parses Claude's response into a WeekPlan
 */
export function parseWeekResponse(responseText: string, weekNumber: number): WeekPlan {
  console.log('Parsing Claude response, length:', responseText.length);

  // Extract JSON
  let jsonStr = responseText.trim();
  const startIndex = jsonStr.indexOf('{');
  if (startIndex > 0) {
    jsonStr = jsonStr.substring(startIndex);
  }

  // Fix truncated JSON
  jsonStr = fixTruncatedJson(jsonStr);

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (error) {
    console.error('JSON parse error:', error);
    console.log('First 500 chars:', jsonStr.substring(0, 500));
    console.log('Last 500 chars:', jsonStr.substring(jsonStr.length - 500));
    throw new Error('Failed to parse training week from AI response');
  }

  console.log('Parsed week with', parsed.workouts?.length || 0, 'workouts');

  // Calculate week dates
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // If generating for current week, use this monday. Otherwise project forward.
  const weekStart = new Date(monday);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const dayToNumber: Record<string, number> = {
    monday: 0,
    tuesday: 1,
    wednesday: 2,
    thursday: 3,
    friday: 4,
    saturday: 5,
    sunday: 6,
  };

  // Transform workouts
  const workouts: Workout[] = (parsed.workouts || []).map((w: any) => {
    const workoutDate = new Date(weekStart);
    const dayStr = (w.dayOfWeek || 'monday').toLowerCase();
    workoutDate.setDate(weekStart.getDate() + (dayToNumber[dayStr] ?? 0));

    return {
      id: `w${weekNumber}-${dayStr}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      date: workoutDate,
      type: (w.type || 'run') as WorkoutType,
      name: w.name || 'Workout',
      duration: w.duration || 45,
      distance: w.distance || undefined,
      description: (w.description || '').replace(/\\n/g, '\n'),
      purpose: w.purpose || '',
      structure: w.structure || [],
      heartRateGuidance: w.heartRateGuidance || '',
      paceGuidance: w.paceGuidance || '',
      coachingTips: w.coachingTips || [],
      adaptationNotes: w.adaptationNotes || '',
      status: 'planned' as const,
    };
  });

  const totalMinutes = workouts.reduce((sum, w) => sum + (w.duration || 0), 0);

  return {
    weekNumber: parsed.weekNumber || weekNumber,
    startDate: weekStart,
    endDate: weekEnd,
    theme: parsed.theme || `Week ${weekNumber}`,
    focus: parsed.focus || '',
    phase: parsed.phase || '',
    totalPlannedHours: Math.round((totalMinutes / 60) * 10) / 10,
    isRecoveryWeek: isRecoveryWeek(weekNumber),
    workouts,
  };
}

// ============================================
// MAIN EXPORT FUNCTION
// ============================================

/**
 * Generates a single week's training plan with full detail
 */
export async function generateWeekPlan(
  userData: OnboardingData,
  weekNumber: number,
  totalWeeks: number,
  completedWeeks: CompletedWeek[],
  nextWeekConstraints?: string
): Promise<WeekPlan> {
  const { user } = buildWeekPrompt(
    userData,
    weekNumber,
    totalWeeks,
    completedWeeks,
    nextWeekConstraints
  );

  console.log(`Generating Week ${weekNumber} of ${totalWeeks}...`);

  // Attach the user's Supabase access token so the proxy can verify it.
  // Phase 1.A — server-side JWT auth on /api/generate-week.
  // Item-8 — proactively refresh if the cached token is within 60s of expiry
  // so an idle tab doesn't get a 401 back from the proxy.
  const accessToken = await getFreshAccessToken(supabase.auth);

  // Phase 1.C — proxy takes `{ user, promptVersion }`. The system prompt
  // lives server-side (`api/_lib/systemPrompt.ts`) so an authenticated
  // user can't curl their own safety-bypassing system payload.
  const response = await fetch('/api/generate-week', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ user, promptVersion: PROMPT_VERSION }),
  });

  if (response.status === 401) {
    throw new Error('Session expired. Please log in again.');
  }

  if (response.status === 429) {
    const DEFAULT_RETRY_AFTER_SECONDS = 60 * 60; // 1 hour fallback if the server didn't say
    const data = await response.json().catch(() => ({}));
    const retryAfterSeconds: number =
      typeof data.retryAfterSeconds === 'number' ? data.retryAfterSeconds : DEFAULT_RETRY_AFTER_SECONDS;
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    throw new Error(
      `You've hit the plan-generation limit. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Claude API error:', errorData);
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  console.log('Received response from Claude');

  if (data.stop_reason === 'max_tokens') {
    console.warn('Response was truncated - will attempt to fix');
  }

  const responseText = data.content[0].text;
  return parseWeekResponse(responseText, weekNumber);
}

/**
 * Creates a summary of a completed week for history context
 */
export function createWeekSummary(week: WeekPlan, feedback: WeekFeedback): WeekSummary {
  const completedWorkouts = week.workouts.filter((w) => w.status === 'completed');
  const plannedHours = week.totalPlannedHours;
  const completedHours =
    completedWorkouts.reduce((sum, w) => sum + (w.actualData?.duration || w.duration), 0) / 60;

  // Identify key workouts (longest or highest intensity)
  const keyWorkouts = week.workouts
    .filter((w) => w.type !== 'rest' && w.type !== 'strength')
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 3)
    .map((w) => ({
      name: w.name,
      type: w.type,
      completed: w.status === 'completed',
      notes: w.actualData?.notes,
    }));

  // Wave 9 / Item-4: completion rate ignores rest days on BOTH sides.
  // Previously the numerator counted a "completed" rest day as a successful
  // workout while the denominator excluded all rest days — inflating the
  // rate by one workout and giving 80% where the user actually trained 60%.
  const nonRestWorkouts = week.workouts.filter((w) => w.type !== 'rest');
  const completedNonRest = nonRestWorkouts.filter((w) => w.status === 'completed');
  const completionRate = nonRestWorkouts.length === 0
    ? 0
    : Math.round((completedNonRest.length / nonRestWorkouts.length) * 100);

  return {
    weekNumber: week.weekNumber,
    phase: week.phase,
    theme: week.theme,
    plannedHours,
    completedHours: Math.round(completedHours * 10) / 10,
    completionRate,
    keyWorkouts,
    feedback,
  };
}