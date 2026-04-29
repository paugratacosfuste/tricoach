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

      parts.push(
        `- Week ${week.weekNumber} (${week.phase}): ` +
        `${week.summary.completedHours.toFixed(1)}h of ${week.summary.plannedHours.toFixed(1)}h ` +
        `(${week.summary.completionRate}% completion). ` +
        `Key sessions: ${keyWorkoutsStr}. ` +
        `Feeling: ${week.summary.feedback.overallFeeling}. ` +
        (week.summary.feedback.physicalIssues.length > 0
          ? `Issues: ${week.summary.feedback.physicalIssues.join(', ')}. `
          : '') +
        (week.summary.feedback.notes ? `Notes: "${week.summary.feedback.notes}"` : '')
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
// PROMPT BUILDER
// ============================================

/**
 * Builds the prompt for generating a single week
 */
function buildWeekPrompt(
  userData: OnboardingData,
  weekNumber: number,
  totalWeeks: number,
  completedWeeks: CompletedWeek[],
  nextWeekConstraints?: string
): string {
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

  // Get last week's feedback if available
  const lastWeek = completedWeeks[completedWeeks.length - 1];
  const lastWeekFeedback = lastWeek?.summary.feedback;

  // Build discipline distribution guidance for triathlon
  const disciplineGuidance = isTriathlon
    ? `
## CRITICAL: WORKOUT DISTRIBUTION FOR TRIATHLON
You MUST include ALL THREE disciplines (swim, bike, run) each week with EQUAL frequency:
- SWIM: 2 sessions per week (skill level affects intensity, NOT frequency)
- BIKE: 2 sessions per week
- RUN: 2 sessions per week
- Optional: 1 strength/mobility session

The athlete's swim level is "${userData.fitness.swimLevel}". This means:
- If beginner: Focus swim sessions on technique drills, shorter intervals, more rest
- If intermediate: Mix technique with aerobic development
- If advanced: Include threshold and race-pace work

DO NOT reduce swim frequency because the athlete is a weaker swimmer. 
Weaker disciplines need MORE practice, not less. Adjust INTENSITY and COMPLEXITY, not frequency.
`
    : '';

  return `You are an expert ${isTriathlon ? 'triathlon' : 'running'} coach creating a detailed weekly training plan.

## ATHLETE PROFILE
- Name: ${userData.profile.firstName}
- Age: ${userData.profile.age}, Weight: ${userData.profile.weight}kg, Height: ${userData.profile.height}cm
- Level: ${userData.fitness.fitnessLevel}
- Max HR: ${userData.fitness.maxHR}bpm
- LTHR: ${userData.fitness.lthr}bpm
- Threshold Pace: ${userData.fitness.thresholdPace}/km
${userData.fitness.ftp ? `- FTP: ${userData.fitness.ftp}W` : ''}
- Swim Level: ${userData.fitness.swimLevel}

## HEART RATE ZONES (based on LTHR ${userData.fitness.lthr})
- Zone 1 Recovery: ${hrZones.zone1.min}-${hrZones.zone1.max}bpm
- Zone 2 Aerobic: ${hrZones.zone2.min}-${hrZones.zone2.max}bpm
- Zone 3 Tempo: ${hrZones.zone3.min}-${hrZones.zone3.max}bpm
- Zone 4 Threshold: ${hrZones.zone4.min}-${hrZones.zone4.max}bpm
- Zone 5 VO2max: ${hrZones.zone5.min}-${hrZones.zone5.max}bpm

## RACE GOAL
- Race: ${userData.goal.raceName} (${userData.goal.raceType})
- Date: ${new Date(userData.goal.raceDate).toLocaleDateString()}
- Weeks until race: ${weeksUntilRace}
- Goal: ${userData.goal.priority}
${userData.goal.goalTime ? `- Target time: ${userData.goal.goalTime}` : ''}
${disciplineGuidance}
## TRAINING CONTEXT
- Currently generating: WEEK ${weekNumber} of ${totalWeeks}
- Training phase: ${phase}
${isRecovery ? '- ⚠️ THIS IS A RECOVERY/DELOAD WEEK - Reduce volume by 30-40%, keep intensity low, but still include all 3 disciplines' : ''}
${lastWeekFeedback?.overallFeeling === 'struggling' || lastWeekFeedback?.overallFeeling === 'tired' ? '- ⚠️ Athlete reported fatigue last week - consider reducing load' : ''}
${lastWeekFeedback?.physicalIssues && lastWeekFeedback.physicalIssues.length > 0 ? `- ⚠️ Physical issues reported: ${lastWeekFeedback.physicalIssues.join(', ')} - adapt accordingly` : ''}
${nextWeekConstraints ? `- ⚠️ Athlete constraint: "${nextWeekConstraints}" - adapt schedule accordingly` : ''}

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

## INSTRUCTIONS
Generate a DETAILED training week. For each workout, provide comprehensive descriptions including:
1. Clear warm-up protocol with duration and intensity
2. Main set with SPECIFIC intervals, paces, HR zones, and recovery periods
3. Cool-down protocol
4. Why this workout matters for their goal

Use the athlete's ACTUAL HR zones and threshold pace in your descriptions.

Return ONLY valid JSON (no markdown, no explanation):
{
  "weekNumber": ${weekNumber},
  "theme": "Week theme (e.g., 'Aerobic Base Building', 'Speed Development')",
  "focus": "Primary focus for the week",
  "phase": "${phase}",
  "workouts": [
    {
      "dayOfWeek": "monday",
      "type": "swim",
      "name": "Technique & Endurance Swim",
      "duration": 45,
      "distance": 2,
      "purpose": "Build swim efficiency and aerobic base for the swim leg",
      "description": "WARM-UP: 200m easy freestyle, 4x50m drill (catch-up, fingertip drag)...\\n\\nMAIN SET: ...\\n\\nCOOL-DOWN: ...",
      "coachingTips": ["tip1", "tip2", "tip3"]
    },
    {
      "dayOfWeek": "tuesday",
      "type": "run",
      "name": "Workout Name",
      "duration": 60,
      "distance": 10,
      "purpose": "Why this workout - connect to their race goal",
      "description": "WARM-UP: 15min easy running at Zone 1 (${hrZones.zone1.min}-${hrZones.zone1.max}bpm)...\\n\\nMAIN SET: ...\\n\\nCOOL-DOWN: ...",
      "coachingTips": ["tip1", "tip2", "tip3"]
    }
  ]
}

RULES:
- Generate 5-7 workouts based on availability (rest days where not available)
${isTriathlon ? '- MANDATORY: Include exactly 2 swim, 2 bike, and 2 run sessions. Adjust intensity based on skill, not frequency.' : '- Focus on running with supporting strength work'}
- type must be: "run", "bike", "swim", "strength", or "rest"
- distance in km (null for strength/rest)
- duration in minutes
- Use \\n for line breaks in description
- Include SPECIFIC HR zones and paces in every description
- NO trailing commas
${isRecovery ? '- This is recovery week: shorter sessions, lower intensity, but still all 3 disciplines' : ''}`;
}

// ============================================
// JSON PARSING
// ============================================

/**
 * Attempts to fix truncated or malformed JSON
 */
export function fixTruncatedJson(str: string): string {
  // Remove markdown code blocks
  str = str.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

  // Count brackets
  let openBraces = 0;
  let openBrackets = 0;
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

    if (!inString) {
      if (char === '{') openBraces++;
      if (char === '}') openBraces--;
      if (char === '[') openBrackets++;
      if (char === ']') openBrackets--;
    }
  }

  // Close unclosed string
  if (inString) {
    str += '"';
  }

  // Remove trailing commas
  str = str.replace(/,\s*$/, '');

  // Add missing brackets/braces
  while (openBrackets > 0) {
    str = str.replace(/,\s*$/, '') + ']';
    openBrackets--;
  }

  while (openBraces > 0) {
    str = str.replace(/,\s*$/, '') + '}';
    openBraces--;
  }

  // Clean trailing commas before closing brackets
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
  const prompt = buildWeekPrompt(
    userData,
    weekNumber,
    totalWeeks,
    completedWeeks,
    nextWeekConstraints
  );

  console.log(`Generating Week ${weekNumber} of ${totalWeeks}...`);

  // Attach the user's Supabase access token so the proxy can verify it.
  // Phase 1.A — server-side JWT auth on /api/generate-week.
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    throw new Error('Not authenticated. Please log in again.');
  }

  // Call the Vercel API proxy instead of Claude directly
  const response = await fetch('/api/generate-week', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ prompt }),
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

  return {
    weekNumber: week.weekNumber,
    phase: week.phase,
    theme: week.theme,
    plannedHours,
    completedHours: Math.round(completedHours * 10) / 10,
    completionRate: Math.round((completedWorkouts.length / week.workouts.filter(w => w.type !== 'rest').length) * 100),
    keyWorkouts,
    feedback,
  };
}