import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { TrainingProvider, useTraining } from '../TrainingContext';
import type { Workout, TrainingPlan, OnboardingData, WeekSummary } from '@/types/training';
import { supabase } from '@/lib/supabase';
import { generateWeekPlan, createWeekSummary } from '@/lib/claudeApi';

// Mock supabase
//
// Wave 9 / Item-4: extended chain so the OLDER tests (that rely on the
// default mock instead of `makeSupabaseMock`) cover every method the prod
// code calls. Production chains end either with `.single()` / `.maybeSingle()`
// (returns `{ data: null, error: null }`) or with a non-terminal call that's
// directly awaited (e.g. `await query.in(...).order(...)`); the latter is
// supported by making the chain itself a thenable resolving to
// `{ data: [], error: null }`.
vi.mock('@/lib/supabase', () => {
  const makeChain = () => {
    const chain: Record<string, unknown> = {
      // `single` returns a row with an id by default so prod code that does
      // `.upsert(...).select('id').single()` (e.g. `savePlanToSupabase`) gets
      // a usable `planRow.id` and doesn't null-deref. `maybeSingle` keeps the
      // null default — `loadPlanFromSupabase` relies on null to fall back to
      // localStorage in tests that haven't seeded a Supabase plan.
      single: vi.fn().mockResolvedValue({
        data: { id: 'mock-default-id' },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null }),
    };
    for (const method of [
      'select', 'insert', 'update', 'upsert', 'delete',
      'eq', 'in', 'order', 'limit',
    ]) {
      chain[method] = vi.fn(() => chain);
    }
    return chain;
  };
  return {
    supabase: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      },
      from: vi.fn(makeChain),
    },
  };
});

// Mock claudeApi
vi.mock('@/lib/claudeApi', () => ({
  generateWeekPlan: vi.fn(),
  createWeekSummary: vi.fn(),
}));

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to create test workout
function createTestWorkout(overrides?: Partial<Workout>): Workout {
  return {
    id: `workout-${Math.random().toString(36).substring(2, 8)}`,
    date: new Date('2025-03-10'),
    type: 'run',
    name: 'Easy Run',
    duration: 45,
    description: 'Easy zone 2 run',
    purpose: 'Build aerobic base',
    structure: [],
    heartRateGuidance: 'Zone 2',
    paceGuidance: '5:30/km',
    coachingTips: [],
    adaptationNotes: '',
    status: 'planned',
    ...overrides,
  };
}

// Helper to create a plan in localStorage for the provider to pick up
function seedPlanInStorage(workouts: Workout[]) {
  const plan: TrainingPlan = {
    id: 'test-plan',
    createdAt: new Date('2025-03-01'),
    raceName: 'Test Race',
    raceDate: new Date('2025-09-01'),
    raceType: 'olympic-triathlon',
    totalWeeks: 20,
    currentWeekNumber: 3,
    currentWeek: {
      weekNumber: 3,
      startDate: new Date('2025-03-10'),
      endDate: new Date('2025-03-16'),
      theme: 'Base Building',
      focus: 'Aerobic',
      phase: 'Base',
      totalPlannedHours: 6,
      isRecoveryWeek: false,
      workouts,
    },
    completedWeeks: [],
  };
  localStorageMock.setItem('tricoach-training-plan', JSON.stringify(plan));
}

function seedUserDataInStorage(): void {
  const userData: OnboardingData = {
    profile: { firstName: 'Test', age: 30, gender: 'male', weight: 70, height: 175 },
    fitness: { fitnessLevel: 'intermediate', lthr: 160, thresholdPace: '5:30', maxHR: 185, swimLevel: 'comfortable' },
    goal: { raceType: 'olympic-triathlon', raceName: 'Test Race', raceDate: new Date('2025-09-01'), priority: 'finish' },
    availability: {
      monday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
      tuesday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
      wednesday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
      thursday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
      friday: { available: false, timeSlots: [], maxDuration: '30min' },
      saturday: { available: true, timeSlots: ['morning'], maxDuration: '2h', longSession: true },
      sunday: { available: true, timeSlots: ['morning'], maxDuration: '2h30', longSession: true },
      weeklyHoursTarget: '8-10h',
    },
    integrations: {
      googleCalendar: { connected: false, avoidConflicts: true },
      strava: { connected: false, autoComplete: true },
    },
  };
  localStorageMock.setItem('tricoach-user-data', JSON.stringify(userData));
}

function makeSupabaseMock(overrides: { weekRowId?: string | null } = {}) {
  const weekRowId = overrides.weekRowId ?? null;
  const updateSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  // Wave 9 / Item-4: `savePlanToSupabase` does `.upsert(...).select('id').single()`,
  // so `upsert` must return a chainable, not a resolved Promise. The thenable
  // chain mirrors the default-mock pattern: terminal calls (`single` /
  // `maybeSingle`) resolve to `{data, error}`; awaiting the chain itself
  // resolves to `{data: [], error: null}` for non-terminal queries.
  const upsertSpy = vi.fn();
  const makeUpsertChain = () => {
    const chain: Record<string, unknown> = {
      single: vi.fn().mockResolvedValue({
        data: { id: 'mock-plan-id' },
        error: null,
      }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: (v: { data: unknown[]; error: null }) => unknown) =>
        resolve({ data: [], error: null }),
    };
    for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
      chain[method] = vi.fn(() => chain);
    }
    return chain;
  };
  upsertSpy.mockImplementation(() => makeUpsertChain());

  vi.mocked(supabase.from).mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    update: updateSpy,
    upsert: upsertSpy,
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: table === 'weeks' && weekRowId ? { id: weekRowId } : null,
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as unknown as ReturnType<typeof supabase.from>));

  return { updateSpy, upsertSpy };
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <TrainingProvider>{children}</TrainingProvider>;
}

// Wave 9 / Item-4: TrainingProvider's mount-effect (`loadData`) is async —
// `await supabase.auth.getUser()` always yields at least one microtask, so a
// synchronously-seeded localStorage plan isn't reflected in `result.current`
// until pending microtasks flush. `renderAndLoad` mounts the hook and then
// `await act(async () => {})` to drain all queued work (Supabase load → null
// → fallback to localStorage → setPlan), so callers can read `plan` directly.
async function renderAndLoad() {
  const hook = renderHook(() => useTraining(), { wrapper });
  await act(async () => {});
  return hook;
}

describe('TrainingContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns null plan when no data in storage', () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      expect(result.current.plan).toBeNull();
      expect(result.current.currentWeek).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('loads plan from localStorage on mount', async () => {
      const workout = createTestWorkout({ id: 'w1' });
      seedPlanInStorage([workout]);

      const { result } = await renderAndLoad();
      expect(result.current.plan).not.toBeNull();
      expect(result.current.plan?.currentWeek?.workouts).toHaveLength(1);
    });
  });

  describe('updateWorkoutStatus', () => {
    it('updates workout status to completed', async () => {
      const workout = createTestWorkout({ id: 'w1', status: 'planned' });
      seedPlanInStorage([workout]);

      const { result } = await renderAndLoad();

      act(() => {
        result.current.updateWorkoutStatus('w1', 'completed', {
          duration: 48,
          feeling: 4,
        });
      });

      const updated = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w1');
      expect(updated?.status).toBe('completed');
      expect(updated?.actualData?.duration).toBe(48);
      expect(updated?.actualData?.feeling).toBe(4);
    });

    it('updates workout status to skipped', async () => {
      const workout = createTestWorkout({ id: 'w2', status: 'planned' });
      seedPlanInStorage([workout]);

      const { result } = await renderAndLoad();

      act(() => {
        result.current.updateWorkoutStatus('w2', 'skipped');
      });

      const updated = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w2');
      expect(updated?.status).toBe('skipped');
    });

    it('does nothing when workout ID not found', async () => {
      const workout = createTestWorkout({ id: 'w1' });
      seedPlanInStorage([workout]);

      const { result } = await renderAndLoad();

      act(() => {
        result.current.updateWorkoutStatus('nonexistent', 'completed');
      });

      // Original workout unchanged
      const w = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w1');
      expect(w?.status).toBe('planned');
    });
  });

  describe('rescheduleWorkout', () => {
    it('moves workout to a new date', async () => {
      const workout = createTestWorkout({
        id: 'w1',
        date: new Date('2025-03-10'),
      });
      seedPlanInStorage([workout]);

      const { result } = await renderAndLoad();

      const newDate = new Date('2025-03-12');
      act(() => {
        result.current.rescheduleWorkout('w1', newDate);
      });

      const updated = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w1');
      expect(new Date(updated!.date).getDate()).toBe(12);
    });

    it('does not affect other workouts', async () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      const w2 = createTestWorkout({ id: 'w2', date: new Date('2025-03-11'), name: 'Swim' });
      seedPlanInStorage([w1, w2]);

      const { result } = await renderAndLoad();

      act(() => {
        result.current.rescheduleWorkout('w1', new Date('2025-03-14'));
      });

      const unchanged = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w2');
      expect(new Date(unchanged!.date).getDate()).toBe(11);
    });
  });

  describe('getWorkoutsForDate', () => {
    it('returns workouts matching the given date', async () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      const w2 = createTestWorkout({ id: 'w2', date: new Date('2025-03-10'), name: 'Swim' });
      const w3 = createTestWorkout({ id: 'w3', date: new Date('2025-03-11'), name: 'Bike' });
      seedPlanInStorage([w1, w2, w3]);

      const { result } = await renderAndLoad();
      const workouts = result.current.getWorkoutsForDate(new Date('2025-03-10'));
      expect(workouts).toHaveLength(2);
    });

    it('returns empty array for dates with no workouts', async () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      seedPlanInStorage([w1]);

      const { result } = await renderAndLoad();
      const workouts = result.current.getWorkoutsForDate(new Date('2025-03-15'));
      expect(workouts).toHaveLength(0);
    });

    it('returns empty array when no plan exists', async () => {
      const { result } = await renderAndLoad();
      const workouts = result.current.getWorkoutsForDate(new Date());
      expect(workouts).toHaveLength(0);
    });
  });

  describe('getWorkoutById', () => {
    it('finds workout by ID', async () => {
      const w1 = createTestWorkout({ id: 'target-workout', name: 'Target Run' });
      seedPlanInStorage([w1]);

      const { result } = await renderAndLoad();
      const found = result.current.getWorkoutById('target-workout');
      expect(found?.name).toBe('Target Run');
    });

    it('returns undefined for unknown ID', async () => {
      seedPlanInStorage([createTestWorkout({ id: 'w1' })]);

      const { result } = await renderAndLoad();
      expect(result.current.getWorkoutById('unknown')).toBeUndefined();
    });
  });

  describe('clearError', () => {
    it('clears the error state', () => {
      const { result } = renderHook(() => useTraining(), { wrapper });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('resetPlan', () => {
    it('clears plan and localStorage', async () => {
      seedPlanInStorage([createTestWorkout()]);

      const { result } = await renderAndLoad();
      expect(result.current.plan).not.toBeNull();

      act(() => {
        result.current.resetPlan();
      });

      expect(result.current.plan).toBeNull();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tricoach-training-plan');
    });
  });

  // ── D1: write-ordering invariant ────────────────────────────────────────
  describe('generateNextWeek — write ordering (D1)', () => {
    const mockSummary: WeekSummary = {
      weekNumber: 3,
      phase: 'Base',
      theme: 'Base Building',
      plannedHours: 6,
      completedHours: 0,
      completionRate: 0,
      keyWorkouts: [],
      feedback: { overallFeeling: 'good', physicalIssues: [], notes: '' },
    };

    it('does NOT write is_completed=true to Supabase when generateWeekPlan throws', async () => {
      vi.mocked(generateWeekPlan).mockRejectedValue(new Error('Anthropic down'));
      vi.mocked(createWeekSummary).mockReturnValue(mockSummary);

      // week-db-id simulates Supabase returning the week row so the update
      // path would be reachable in the old (broken) ordering
      const { updateSpy } = makeSupabaseMock({ weekRowId: 'week-db-id' });

      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {}); // allow initial load

      await act(async () => {
        await result.current.generateNextWeek({
          overallFeeling: 'good',
          physicalIssues: [],
          notes: '',
        });
      });

      expect(result.current.error).toBe('Anthropic down');
      expect(updateSpy).not.toHaveBeenCalledWith({ is_completed: true });
    });

    it('writes is_completed=true only after generateWeekPlan succeeds', async () => {
      const nextWeekMock = {
        weekNumber: 4,
        startDate: new Date(),
        endDate: new Date(),
        theme: 'Next',
        focus: 'Speed',
        phase: 'Build',
        totalPlannedHours: 7,
        isRecoveryWeek: false,
        workouts: [],
      };
      vi.mocked(generateWeekPlan).mockResolvedValue(nextWeekMock);
      vi.mocked(createWeekSummary).mockReturnValue(mockSummary);

      const { updateSpy } = makeSupabaseMock({ weekRowId: 'week-db-id' });

      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.generateNextWeek({
          overallFeeling: 'good',
          physicalIssues: [],
          notes: '',
        });
      });

      expect(result.current.error).toBeNull();
      expect(updateSpy).toHaveBeenCalledWith({ is_completed: true });
      expect(result.current.plan?.currentWeek?.weekNumber).toBe(4);
    });
  });

  // ── Wave 6.5: rebuildPlanForGoal + syncUserGoal ──────────────────────────
  describe('rebuildPlanForGoal (Wave 6.5)', () => {
    const fakeNewWeek = {
      weekNumber: 1,
      startDate: new Date('2026-05-11'),
      endDate: new Date('2026-05-17'),
      theme: 'Foundation',
      focus: 'Aerobic',
      phase: 'Base',
      totalPlannedHours: 6,
      isRecoveryWeek: false,
      workouts: [],
    };

    function seedUserDataWithGoal(raceDateISO: string): void {
      const stored = JSON.parse(
        localStorageMock.getItem('tricoach-user-data') || '{}',
      );
      stored.goal = {
        ...(stored.goal ?? {}),
        raceType: 'ironman-70.3',
        raceName: 'Test Race',
        raceDate: new Date(raceDateISO),
        priority: 'finish',
      };
      localStorageMock.setItem('tricoach-user-data', JSON.stringify(stored));
    }

    beforeEach(() => {
      // Freeze "today" so differenceInWeeks is deterministic.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-05-06T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('recomputes totalWeeks from raceDate (mid-range case)', async () => {
      vi.mocked(generateWeekPlan).mockResolvedValue(fakeNewWeek);
      makeSupabaseMock({ weekRowId: 'week-db-id' });

      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();
      // 21 weeks from frozen now (2026-05-06 → 2026-09-30)
      seedUserDataWithGoal('2026-09-30');

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.rebuildPlanForGoal();
      });

      expect(result.current.error).toBeNull();
      // 21 weeks falls within the 8–24 clamp.
      expect(result.current.plan?.totalWeeks).toBe(21);
    });

    it('clamps to a minimum of 8 weeks when race is too close', async () => {
      vi.mocked(generateWeekPlan).mockResolvedValue(fakeNewWeek);
      makeSupabaseMock({ weekRowId: 'week-db-id' });

      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();
      // 4 weeks out — below the 8-week floor.
      seedUserDataWithGoal('2026-06-03');

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.rebuildPlanForGoal();
      });

      expect(result.current.plan?.totalWeeks).toBe(8);
    });

    it('clamps to a maximum of 24 weeks when race is far away', async () => {
      vi.mocked(generateWeekPlan).mockResolvedValue(fakeNewWeek);
      makeSupabaseMock({ weekRowId: 'week-db-id' });

      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();
      // 30 weeks out — above the 24-week ceiling.
      seedUserDataWithGoal('2026-12-02');

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.rebuildPlanForGoal();
      });

      expect(result.current.plan?.totalWeeks).toBe(24);
    });

    it('preserves completedWeeks when rebuilding', async () => {
      vi.mocked(generateWeekPlan).mockResolvedValue(fakeNewWeek);
      makeSupabaseMock({ weekRowId: 'week-db-id' });

      // Seed plan with 2 completed weeks already in storage.
      const planJson = JSON.parse(
        JSON.stringify({
          id: 'test-plan',
          createdAt: new Date('2025-03-01'),
          raceName: 'Old Race',
          raceDate: new Date('2025-09-01'),
          raceType: 'olympic-triathlon',
          totalWeeks: 13,
          currentWeekNumber: 3,
          currentWeek: {
            weekNumber: 3,
            startDate: new Date('2025-03-10'),
            endDate: new Date('2025-03-16'),
            theme: 'Base Building',
            focus: 'Aerobic',
            phase: 'Base',
            totalPlannedHours: 6,
            isRecoveryWeek: false,
            workouts: [],
          },
          completedWeeks: [
            {
              weekNumber: 1,
              startDate: new Date('2025-02-24'),
              endDate: new Date('2025-03-02'),
              theme: 'W1',
              focus: 'Aerobic',
              phase: 'Base',
              totalPlannedHours: 6,
              workouts: [],
              summary: { feedback: { overallFeeling: 'okay', physicalIssues: [], notes: '' } },
            },
            {
              weekNumber: 2,
              startDate: new Date('2025-03-03'),
              endDate: new Date('2025-03-09'),
              theme: 'W2',
              focus: 'Aerobic',
              phase: 'Base',
              totalPlannedHours: 6,
              workouts: [],
              summary: { feedback: { overallFeeling: 'good', physicalIssues: [], notes: '' } },
            },
          ],
        }),
      );
      localStorageMock.setItem('tricoach-training-plan', JSON.stringify(planJson));
      seedUserDataInStorage();
      seedUserDataWithGoal('2026-09-30');

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        await result.current.rebuildPlanForGoal();
      });

      expect(result.current.plan?.completedWeeks).toHaveLength(2);
    });
  });

  describe('syncUserGoal (Wave 6.5)', () => {
    it('updates userData.goal in memory so the AI prompt sees the new race without refresh', async () => {
      seedPlanInStorage([createTestWorkout()]);
      seedUserDataInStorage();

      const { result } = renderHook(() => useTraining(), { wrapper });
      await act(async () => {});

      await act(async () => {
        result.current.syncUserGoal({
          raceType: 'ironman-70.3',
          raceName: 'Platja D\'Aro Ironman',
          raceDate: new Date('2026-10-04'),
          priority: 'finish',
        });
      });

      // Verify the next call to generateWeekPlan would receive the new goal:
      // we read the persisted localStorage cache (which generateNextWeek would
      // also pull from on a fresh mount).
      const cached = JSON.parse(
        localStorageMock.getItem('tricoach-user-data') || '{}',
      );
      expect(cached.goal.raceType).toBe('ironman-70.3');
      expect(cached.goal.raceName).toBe('Platja D\'Aro Ironman');
    });
  });
});
