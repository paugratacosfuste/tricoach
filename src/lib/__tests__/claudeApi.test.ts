import { describe, it, expect } from 'vitest';
import {
  fixTruncatedJson,
  parseWeekResponse,
  buildHistoryContext,
  createWeekSummary,
} from '../claudeApi';
import type { CompletedWeek, WeekPlan, WeekFeedback } from '@/types/training';

// ============================================
// fixTruncatedJson
// ============================================

describe('fixTruncatedJson', () => {
  it('passes through valid JSON unchanged', () => {
    const input = '{"key": "value"}';
    const result = fixTruncatedJson(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('strips markdown code block wrappers', () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = fixTruncatedJson(input);
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('closes unclosed strings', () => {
    const input = '{"key": "value';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('closes missing braces', () => {
    const input = '{"key": "value"';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ key: 'value' });
  });

  it('closes missing brackets', () => {
    const input = '{"workouts": [{"type": "run"}';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });

  it('removes trailing commas', () => {
    const input = '{"a": 1, "b": 2,}';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ a: 1, b: 2 });
  });

  it('handles trailing commas inside arrays', () => {
    const input = '{"items": [1, 2, 3,]}';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).items).toEqual([1, 2, 3]);
  });

  it('handles deeply truncated JSON with multiple unclosed levels', () => {
    const input = '{"workouts": [{"type": "run", "name": "Easy Run"';
    const result = fixTruncatedJson(input);
    expect(() => JSON.parse(result)).not.toThrow();
  });
});

// ============================================
// parseWeekResponse
// ============================================

describe('parseWeekResponse', () => {
  const validResponse = JSON.stringify({
    weekNumber: 3,
    theme: 'Base Building',
    focus: 'Aerobic foundation',
    phase: 'Base',
    workouts: [
      {
        dayOfWeek: 'monday',
        type: 'run',
        name: 'Easy Run',
        duration: 45,
        distance: 8,
        purpose: 'Build aerobic base',
        description: 'WARM-UP: 10min easy\\nMAIN SET: 25min Z2\\nCOOL-DOWN: 10min easy',
        coachingTips: ['Keep HR in Zone 2', 'Focus on form'],
      },
      {
        dayOfWeek: 'wednesday',
        type: 'swim',
        name: 'Technique Swim',
        duration: 50,
        distance: 2,
        purpose: 'Improve swim efficiency',
        description: 'WARM-UP: 200m easy\\nMAIN SET: drills\\nCOOL-DOWN: 100m easy',
        coachingTips: ['Focus on catch'],
      },
    ],
  });

  it('parses valid JSON response', () => {
    const result = parseWeekResponse(validResponse, 3);
    expect(result.weekNumber).toBe(3);
    expect(result.theme).toBe('Base Building');
    expect(result.phase).toBe('Base');
    expect(result.workouts).toHaveLength(2);
  });

  it('assigns dates based on dayOfWeek', () => {
    const result = parseWeekResponse(validResponse, 3);
    const mondayWorkout = result.workouts[0];
    const wednesdayWorkout = result.workouts[1];

    // Monday workout should be before Wednesday workout
    expect(new Date(mondayWorkout.date).getTime()).toBeLessThan(
      new Date(wednesdayWorkout.date).getTime()
    );

    // Wednesday is 2 days after Monday
    const dayDiff = Math.round(
      (new Date(wednesdayWorkout.date).getTime() - new Date(mondayWorkout.date).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    expect(dayDiff).toBe(2);
  });

  it('generates unique IDs for each workout', () => {
    const result = parseWeekResponse(validResponse, 3);
    const ids = result.workouts.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('calculates totalPlannedHours from workout durations', () => {
    const result = parseWeekResponse(validResponse, 3);
    // 45 + 50 = 95 minutes = 1.583... hours => rounded to 1.6
    expect(result.totalPlannedHours).toBeCloseTo(1.6, 1);
  });

  it('strips leading non-JSON text', () => {
    const response = 'Here is your training plan:\n\n' + validResponse;
    const result = parseWeekResponse(response, 3);
    expect(result.weekNumber).toBe(3);
    expect(result.workouts).toHaveLength(2);
  });

  it('sets all workouts to planned status', () => {
    const result = parseWeekResponse(validResponse, 3);
    result.workouts.forEach((w) => {
      expect(w.status).toBe('planned');
    });
  });

  it('converts \\n in descriptions to actual newlines', () => {
    const result = parseWeekResponse(validResponse, 3);
    expect(result.workouts[0].description).toContain('\n');
    expect(result.workouts[0].description).not.toContain('\\n');
  });

  it('handles missing optional fields gracefully', () => {
    const minimal = JSON.stringify({
      workouts: [
        { dayOfWeek: 'tuesday', type: 'run', name: 'Run', duration: 30 },
      ],
    });
    const result = parseWeekResponse(minimal, 5);
    expect(result.weekNumber).toBe(5);
    expect(result.workouts[0].coachingTips).toEqual([]);
    expect(result.workouts[0].purpose).toBe('');
  });

  it('sets startDate and endDate as a 7-day range', () => {
    const result = parseWeekResponse(validResponse, 1);
    const diff = Math.round(
      (new Date(result.endDate).getTime() - new Date(result.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    expect(diff).toBe(6);
  });
});

// ============================================
// buildHistoryContext
// ============================================

describe('buildHistoryContext', () => {
  const makeFeedback = (feeling: string = 'good'): WeekFeedback => ({
    overallFeeling: feeling as any,
    physicalIssues: [],
    notes: '',
  });

  const makeWeek = (weekNum: number, overrides?: Partial<CompletedWeek>): CompletedWeek => ({
    weekNumber: weekNum,
    startDate: new Date('2025-01-06'),
    endDate: new Date('2025-01-12'),
    phase: 'Base',
    theme: `Week ${weekNum}`,
    focus: 'Aerobic',
    totalPlannedHours: 6,
    workouts: [],
    summary: {
      weekNumber: weekNum,
      phase: 'Base',
      theme: `Week ${weekNum}`,
      plannedHours: 6,
      completedHours: 5,
      completionRate: 83,
      keyWorkouts: [
        { name: 'Long Run', type: 'run', completed: true },
      ],
      feedback: makeFeedback(),
    },
    ...overrides,
  });

  it('returns first-week message for empty history', () => {
    const result = buildHistoryContext([]);
    expect(result).toContain('first week');
    expect(result).toContain('No prior history');
  });

  it('includes detailed recent weeks (last 2)', () => {
    const weeks = [makeWeek(1), makeWeek(2), makeWeek(3)];
    const result = buildHistoryContext(weeks);
    expect(result).toContain('RECENT WEEKS');
    expect(result).toContain('Week 2');
    expect(result).toContain('Week 3');
  });

  it('compresses older weeks into summary', () => {
    const weeks = [makeWeek(1), makeWeek(2), makeWeek(3), makeWeek(4)];
    const result = buildHistoryContext(weeks);
    expect(result).toContain('TRAINING HISTORY');
    expect(result).toContain('Average completion');
  });

  it('reports recurring physical issues', () => {
    const issueWeek = (weekNum: number): CompletedWeek =>
      makeWeek(weekNum, {
        summary: {
          ...makeWeek(weekNum).summary,
          feedback: {
            overallFeeling: 'okay',
            physicalIssues: ['knee pain'],
            notes: '',
          },
        },
      });

    const weeks = [issueWeek(1), issueWeek(2), issueWeek(3), makeWeek(4), makeWeek(5)];
    const result = buildHistoryContext(weeks);
    expect(result).toContain('Recurring issues');
    expect(result).toContain('knee pain');
  });

  it('includes completion rate and hours for older weeks', () => {
    const weeks = [makeWeek(1), makeWeek(2), makeWeek(3)];
    const result = buildHistoryContext(weeks);
    expect(result).toContain('avg');
    expect(result).toContain('h/week');
  });
});

// ============================================
// createWeekSummary
// ============================================

describe('createWeekSummary', () => {
  const makeWorkout = (type: string, duration: number, status: string, actualDuration?: number) => ({
    id: `w-${Math.random()}`,
    date: new Date(),
    type: type as any,
    name: `${type} workout`,
    duration,
    description: '',
    purpose: '',
    structure: [],
    heartRateGuidance: '',
    paceGuidance: '',
    coachingTips: [],
    adaptationNotes: '',
    status: status as any,
    ...(actualDuration
      ? { actualData: { duration: actualDuration, feeling: 3 as const } }
      : {}),
  });

  const weekPlan: WeekPlan = {
    weekNumber: 2,
    startDate: new Date('2025-01-13'),
    endDate: new Date('2025-01-19'),
    theme: 'Build Phase',
    focus: 'Tempo development',
    phase: 'Build 1',
    totalPlannedHours: 7.5,
    isRecoveryWeek: false,
    workouts: [
      makeWorkout('run', 60, 'completed', 55),
      makeWorkout('swim', 45, 'completed', 50),
      makeWorkout('bike', 90, 'skipped'),
      makeWorkout('run', 45, 'completed', 40),
      makeWorkout('rest', 0, 'completed'),
      makeWorkout('strength', 30, 'planned'),
    ],
  };

  const feedback: WeekFeedback = {
    overallFeeling: 'good',
    physicalIssues: ['tight calves'],
    notes: 'Felt strong on runs',
  };

  it('calculates completion rate based on non-rest workouts', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    // 5 non-rest workouts, 3 completed = 60%
    expect(summary.completionRate).toBe(60);
  });

  it('calculates completed hours from actual data', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    // actualData durations: 55 + 50 + 40 = 145 minutes = 2.4166... hours
    expect(summary.completedHours).toBeCloseTo(2.4, 1);
  });

  it('identifies key workouts by longest duration', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    // Key workouts are the top 3 non-rest, non-strength, sorted by duration desc
    expect(summary.keyWorkouts.length).toBeLessThanOrEqual(3);
    expect(summary.keyWorkouts[0].type).toBe('bike'); // 90min is longest
  });

  it('includes feedback in summary', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    expect(summary.feedback.overallFeeling).toBe('good');
    expect(summary.feedback.physicalIssues).toContain('tight calves');
  });

  it('rounds completedHours to one decimal', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    const decimalPart = summary.completedHours.toString().split('.')[1] || '';
    expect(decimalPart.length).toBeLessThanOrEqual(1);
  });

  it('preserves week metadata', () => {
    const summary = createWeekSummary(weekPlan, feedback);
    expect(summary.weekNumber).toBe(2);
    expect(summary.phase).toBe('Build 1');
    expect(summary.theme).toBe('Build Phase');
    expect(summary.plannedHours).toBe(7.5);
  });
});
