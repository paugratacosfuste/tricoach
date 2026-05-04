import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { TrainingProvider, useTraining } from '../TrainingContext';
import type { Workout, TrainingPlan, OnboardingData, WeekSummary } from '@/types/training';
import { supabase } from '@/lib/supabase';
import { generateWeekPlan, createWeekSummary } from '@/lib/claudeApi';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

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
  const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

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

    it('loads plan from localStorage on mount', () => {
      const workout = createTestWorkout({ id: 'w1' });
      seedPlanInStorage([workout]);

      const { result } = renderHook(() => useTraining(), { wrapper });
      expect(result.current.plan).not.toBeNull();
      expect(result.current.plan?.currentWeek?.workouts).toHaveLength(1);
    });
  });

  describe('updateWorkoutStatus', () => {
    it('updates workout status to completed', () => {
      const workout = createTestWorkout({ id: 'w1', status: 'planned' });
      seedPlanInStorage([workout]);

      const { result } = renderHook(() => useTraining(), { wrapper });

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

    it('updates workout status to skipped', () => {
      const workout = createTestWorkout({ id: 'w2', status: 'planned' });
      seedPlanInStorage([workout]);

      const { result } = renderHook(() => useTraining(), { wrapper });

      act(() => {
        result.current.updateWorkoutStatus('w2', 'skipped');
      });

      const updated = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w2');
      expect(updated?.status).toBe('skipped');
    });

    it('does nothing when workout ID not found', () => {
      const workout = createTestWorkout({ id: 'w1' });
      seedPlanInStorage([workout]);

      const { result } = renderHook(() => useTraining(), { wrapper });

      act(() => {
        result.current.updateWorkoutStatus('nonexistent', 'completed');
      });

      // Original workout unchanged
      const w = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w1');
      expect(w?.status).toBe('planned');
    });
  });

  describe('rescheduleWorkout', () => {
    it('moves workout to a new date', () => {
      const workout = createTestWorkout({
        id: 'w1',
        date: new Date('2025-03-10'),
      });
      seedPlanInStorage([workout]);

      const { result } = renderHook(() => useTraining(), { wrapper });

      const newDate = new Date('2025-03-12');
      act(() => {
        result.current.rescheduleWorkout('w1', newDate);
      });

      const updated = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w1');
      expect(new Date(updated!.date).getDate()).toBe(12);
    });

    it('does not affect other workouts', () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      const w2 = createTestWorkout({ id: 'w2', date: new Date('2025-03-11'), name: 'Swim' });
      seedPlanInStorage([w1, w2]);

      const { result } = renderHook(() => useTraining(), { wrapper });

      act(() => {
        result.current.rescheduleWorkout('w1', new Date('2025-03-14'));
      });

      const unchanged = result.current.plan?.currentWeek?.workouts.find((w) => w.id === 'w2');
      expect(new Date(unchanged!.date).getDate()).toBe(11);
    });
  });

  describe('getWorkoutsForDate', () => {
    it('returns workouts matching the given date', () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      const w2 = createTestWorkout({ id: 'w2', date: new Date('2025-03-10'), name: 'Swim' });
      const w3 = createTestWorkout({ id: 'w3', date: new Date('2025-03-11'), name: 'Bike' });
      seedPlanInStorage([w1, w2, w3]);

      const { result } = renderHook(() => useTraining(), { wrapper });
      const workouts = result.current.getWorkoutsForDate(new Date('2025-03-10'));
      expect(workouts).toHaveLength(2);
    });

    it('returns empty array for dates with no workouts', () => {
      const w1 = createTestWorkout({ id: 'w1', date: new Date('2025-03-10') });
      seedPlanInStorage([w1]);

      const { result } = renderHook(() => useTraining(), { wrapper });
      const workouts = result.current.getWorkoutsForDate(new Date('2025-03-15'));
      expect(workouts).toHaveLength(0);
    });

    it('returns empty array when no plan exists', () => {
      const { result } = renderHook(() => useTraining(), { wrapper });
      const workouts = result.current.getWorkoutsForDate(new Date());
      expect(workouts).toHaveLength(0);
    });
  });

  describe('getWorkoutById', () => {
    it('finds workout by ID', () => {
      const w1 = createTestWorkout({ id: 'target-workout', name: 'Target Run' });
      seedPlanInStorage([w1]);

      const { result } = renderHook(() => useTraining(), { wrapper });
      const found = result.current.getWorkoutById('target-workout');
      expect(found?.name).toBe('Target Run');
    });

    it('returns undefined for unknown ID', () => {
      seedPlanInStorage([createTestWorkout({ id: 'w1' })]);

      const { result } = renderHook(() => useTraining(), { wrapper });
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
    it('clears plan and localStorage', () => {
      seedPlanInStorage([createTestWorkout()]);

      const { result } = renderHook(() => useTraining(), { wrapper });
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
});
