import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { TrainingProvider, useTraining } from '../TrainingContext';
import type { Workout, WeekPlan, TrainingPlan } from '@/types/training';

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
});
