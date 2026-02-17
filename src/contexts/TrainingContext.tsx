// src/contexts/TrainingContext.tsx
//
// PURPOSE: Manages all training plan state.
// Handles week generation, workout completion, and history tracking.
// Persists data to Supabase with localStorage as fallback cache.

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  TrainingPlan,
  WeekPlan,
  Workout,
  CompletedWeek,
  WeekFeedback,
  OnboardingData,
  WorkoutStatus,
} from '@/types/training';
import { generateWeekPlan, createWeekSummary } from '@/lib/claudeApi';
import { supabase } from '@/lib/supabase';

// ============================================
// CONTEXT TYPES
// ============================================

interface TrainingContextType {
  // State
  plan: TrainingPlan | null;
  currentWeek: WeekPlan | null;
  isLoading: boolean;
  error: string | null;

  // Plan management
  initializePlan: (userData: OnboardingData) => Promise<void>;
  generateNextWeek: (feedback: WeekFeedback, constraints?: string) => Promise<void>;

  // Workout management
  updateWorkoutStatus: (workoutId: string, status: WorkoutStatus, actualData?: Workout['actualData']) => void;
  getWorkoutById: (workoutId: string) => Workout | undefined;
  getTodaysWorkout: () => Workout | undefined;
  getUpcomingWorkouts: (count: number) => Workout[];
  getWorkoutsForDate: (date: Date) => Workout[];

  // Week management
  completeCurrentWeek: (feedback: WeekFeedback) => void;

  // Utilities
  clearError: () => void;
  resetPlan: () => void;
}

const TrainingContext = createContext<TrainingContextType | undefined>(undefined);

// ============================================
// LOCAL STORAGE KEYS (used as offline cache)
// ============================================

const STORAGE_KEYS = {
  PLAN: 'tricoach-training-plan',
  USER_DATA: 'tricoach-user-data',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateTotalWeeks(raceDate: Date): number {
  const now = new Date();
  const diffTime = new Date(raceDate).getTime() - now.getTime();
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return Math.max(1, Math.min(52, diffWeeks)); // Cap at 52 weeks
}

function savePlanToStorage(plan: TrainingPlan): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAN, JSON.stringify(plan));
  } catch (error) {
    console.error('Failed to save plan to localStorage:', error);
  }
}

function loadPlanFromStorage(): TrainingPlan | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAN);
    if (!stored) return null;

    const plan = JSON.parse(stored);

    // Rehydrate dates
    plan.createdAt = new Date(plan.createdAt);
    plan.raceDate = new Date(plan.raceDate);

    if (plan.currentWeek) {
      plan.currentWeek.startDate = new Date(plan.currentWeek.startDate);
      plan.currentWeek.endDate = new Date(plan.currentWeek.endDate);
      plan.currentWeek.workouts = plan.currentWeek.workouts.map((w: any) => ({
        ...w,
        date: new Date(w.date),
      }));
    }

    plan.completedWeeks = plan.completedWeeks.map((week: any) => ({
      ...week,
      startDate: new Date(week.startDate),
      endDate: new Date(week.endDate),
      workouts: week.workouts.map((w: any) => ({
        ...w,
        date: new Date(w.date),
      })),
    }));

    return plan;
  } catch (error) {
    console.error('Failed to load plan from localStorage:', error);
    return null;
  }
}

function saveUserDataToStorage(userData: OnboardingData): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to save user data to localStorage:', error);
  }
}

function loadUserDataFromStorage(): OnboardingData | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.USER_DATA);
    if (!stored) return null;

    const data = JSON.parse(stored);
    if (data.goal?.raceDate) {
      data.goal.raceDate = new Date(data.goal.raceDate);
    }
    return data;
  } catch (error) {
    console.error('Failed to load user data from localStorage:', error);
    return null;
  }
}

// ============================================
// SUPABASE PERSISTENCE HELPERS
// ============================================

async function saveWeekToSupabase(planId: string, week: WeekPlan | CompletedWeek, isCompleted: boolean = false): Promise<string | null> {
  try {
    const { data: weekRow, error: weekError } = await supabase
      .from('weeks')
      .upsert({
        plan_id: planId,
        week_number: week.weekNumber,
        start_date: week.startDate instanceof Date ? week.startDate.toISOString().split('T')[0] : week.startDate,
        end_date: week.endDate instanceof Date ? week.endDate.toISOString().split('T')[0] : week.endDate,
        theme: week.theme,
        focus: week.focus,
        phase: week.phase,
        total_planned_hours: week.totalPlannedHours,
        is_recovery_week: ('isRecoveryWeek' in week && week.isRecoveryWeek) || false,
        is_completed: isCompleted,
      }, { onConflict: 'plan_id,week_number' })
      .select('id')
      .single();

    if (weekError) {
      console.error('Error saving week to Supabase:', weekError);
      return null;
    }

    const weekId = weekRow.id;

    // Save workouts for this week
    const workoutRows = week.workouts.map((w) => ({
      week_id: weekId,
      date: w.date instanceof Date ? w.date.toISOString().split('T')[0] : w.date,
      type: w.type,
      name: w.name,
      duration: w.duration,
      distance: w.distance || null,
      description: w.description,
      purpose: w.purpose,
      structure: w.structure || null,
      heart_rate_guidance: w.heartRateGuidance || null,
      pace_guidance: w.paceGuidance || null,
      coaching_tips: w.coachingTips || null,
      adaptation_notes: w.adaptationNotes || null,
      status: w.status || 'planned',
      actual_duration: w.actualData?.duration || null,
      actual_distance: w.actualData?.distance || null,
      actual_avg_hr: w.actualData?.avgHR || null,
      actual_feeling: w.actualData?.feeling || null,
      actual_notes: w.actualData?.notes || null,
    }));

    // Delete existing workouts for this week and re-insert
    await supabase.from('workouts').delete().eq('week_id', weekId);

    const { error: workoutError } = await supabase
      .from('workouts')
      .insert(workoutRows);

    if (workoutError) {
      console.error('Error saving workouts to Supabase:', workoutError);
    }

    return weekId;
  } catch (error) {
    console.error('Error in saveWeekToSupabase:', error);
    return null;
  }
}

async function savePlanToSupabase(plan: TrainingPlan, userId: string): Promise<string | null> {
  try {
    // Upsert the plan
    const { data: planRow, error: planError } = await supabase
      .from('training_plans')
      .upsert({
        id: plan.id.startsWith('plan-') ? undefined : plan.id, // Let Supabase generate UUID if it's a local ID
        user_id: userId,
        race_name: plan.raceName,
        race_date: plan.raceDate instanceof Date ? plan.raceDate.toISOString().split('T')[0] : plan.raceDate,
        race_type: plan.raceType,
        total_weeks: plan.totalWeeks,
        current_week_number: plan.currentWeekNumber,
        is_active: true,
      })
      .select('id')
      .single();

    if (planError) {
      console.error('Error saving plan to Supabase:', planError);
      return null;
    }

    const planId = planRow.id;

    // Save current week
    if (plan.currentWeek) {
      await saveWeekToSupabase(planId, plan.currentWeek, false);
    }

    // Save completed weeks
    for (const week of plan.completedWeeks) {
      await saveWeekToSupabase(planId, week, true);
    }

    return planId;
  } catch (error) {
    console.error('Error in savePlanToSupabase:', error);
    return null;
  }
}

async function loadPlanFromSupabase(userId: string): Promise<{ plan: TrainingPlan; userData: OnboardingData } | null> {
  try {
    // Get active plan
    const { data: planRow, error: planError } = await supabase
      .from('training_plans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (planError || !planRow) return null;

    // Get all weeks for this plan
    const { data: weekRows, error: weekError } = await supabase
      .from('weeks')
      .select('*')
      .eq('plan_id', planRow.id)
      .order('week_number', { ascending: true });

    if (weekError) return null;

    // Get all workouts for all weeks
    const weekIds = (weekRows || []).map(w => w.id);
    const { data: workoutRows } = await supabase
      .from('workouts')
      .select('*')
      .in('week_id', weekIds.length > 0 ? weekIds : ['none'])
      .order('date', { ascending: true });

    // Get user profile for userData
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    // Build workout map by week_id
    const workoutsByWeek: Record<string, any[]> = {};
    (workoutRows || []).forEach(w => {
      if (!workoutsByWeek[w.week_id]) workoutsByWeek[w.week_id] = [];
      workoutsByWeek[w.week_id].push(w);
    });

    // Build WeekPlan objects
    const buildWeekPlan = (weekRow: any): WeekPlan => {
      const workouts = (workoutsByWeek[weekRow.id] || []).map((w: any) => ({
        id: w.id,
        date: new Date(w.date),
        type: w.type,
        name: w.name,
        duration: w.duration,
        distance: w.distance ? Number(w.distance) : undefined,
        description: w.description || '',
        purpose: w.purpose || '',
        structure: w.structure || [],
        heartRateGuidance: w.heart_rate_guidance || '',
        paceGuidance: w.pace_guidance || '',
        coachingTips: w.coaching_tips || [],
        adaptationNotes: w.adaptation_notes || '',
        status: w.status || 'planned',
        actualData: w.actual_duration || w.actual_distance || w.actual_feeling ? {
          duration: w.actual_duration || 0,
          distance: w.actual_distance ? Number(w.actual_distance) : undefined,
          avgHR: w.actual_avg_hr || undefined,
          feeling: w.actual_feeling || undefined,
          notes: w.actual_notes || undefined,
        } : undefined,
      }));

      return {
        weekNumber: weekRow.week_number,
        startDate: new Date(weekRow.start_date),
        endDate: new Date(weekRow.end_date),
        theme: weekRow.theme || '',
        focus: weekRow.focus || '',
        phase: weekRow.phase || 'Base',
        totalPlannedHours: Number(weekRow.total_planned_hours) || 0,
        isRecoveryWeek: weekRow.is_recovery_week || false,
        workouts,
      };
    };

    // Separate current and completed weeks
    const completedWeekRows = (weekRows || []).filter(w => w.is_completed);
    const currentWeekRow = (weekRows || []).find(w => !w.is_completed);

    const completedWeeks: CompletedWeek[] = completedWeekRows.map(w => {
      const weekPlan = buildWeekPlan(w);
      return {
        ...weekPlan,
        summary: {
          weekNumber: weekPlan.weekNumber,
          phase: weekPlan.phase,
          theme: weekPlan.theme,
          plannedHours: weekPlan.totalPlannedHours,
          completedHours: 0,
          completionRate: 0,
          keyWorkouts: [],
          feedback: { overallFeeling: 'okay' as const },
        },
      };
    });

    const plan: TrainingPlan = {
      id: planRow.id,
      createdAt: new Date(planRow.created_at),
      raceName: planRow.race_name,
      raceDate: new Date(planRow.race_date),
      raceType: planRow.race_type,
      totalWeeks: planRow.total_weeks,
      currentWeekNumber: planRow.current_week_number,
      currentWeek: currentWeekRow ? buildWeekPlan(currentWeekRow) : null,
      completedWeeks,
    };

    // Build userData from profile
    const userData: OnboardingData = {
      profile: {
        firstName: profileRow?.first_name || '',
        age: profileRow?.age || 30,
        gender: profileRow?.gender || 'male',
        weight: profileRow?.weight ? Number(profileRow.weight) : 70,
        height: profileRow?.height || 175,
      },
      fitness: {
        fitnessLevel: profileRow?.fitness_level || 'intermediate',
        lthr: profileRow?.lthr || 160,
        thresholdPace: profileRow?.threshold_pace || '5:30',
        maxHR: profileRow?.max_hr || 185,
        ftp: profileRow?.ftp || undefined,
        swimLevel: profileRow?.swim_level || 'comfortable',
      },
      goal: {
        raceType: planRow.race_type,
        raceName: planRow.race_name,
        raceDate: new Date(planRow.race_date),
        goalTime: planRow.goal_time || undefined,
        priority: planRow.goal_priority || 'finish',
      },
      availability: profileRow?.weekly_availability || {
        monday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
        tuesday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
        wednesday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
        thursday: { available: true, timeSlots: ['evening'], maxDuration: '60min' },
        friday: { available: false, timeSlots: [], maxDuration: '30min' },
        saturday: { available: true, timeSlots: ['morning'], maxDuration: '2h', longSession: true },
        sunday: { available: true, timeSlots: ['morning'], maxDuration: '2h30', longSession: true },
        weeklyHoursTarget: '8-10h',
      },
      integrations: profileRow?.integrations || {
        googleCalendar: { connected: false, avoidConflicts: true },
        strava: { connected: false, autoComplete: true },
      },
    };

    return { plan, userData };
  } catch (error) {
    console.error('Error loading plan from Supabase:', error);
    return null;
  }
}

// ============================================
// PROVIDER COMPONENT
// ============================================

export function TrainingProvider({ children }: { children: ReactNode }) {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [userData, setUserData] = useState<OnboardingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data on mount: try Supabase first, fall back to localStorage
  useEffect(() => {
    const loadData = async () => {
      // Try Supabase first
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const supabaseData = await loadPlanFromSupabase(user.id);
        if (supabaseData) {
          setPlan(supabaseData.plan);
          setUserData(supabaseData.userData);
          // Also cache to localStorage
          savePlanToStorage(supabaseData.plan);
          saveUserDataToStorage(supabaseData.userData);
          return;
        }
      }

      // Fall back to localStorage
      const storedPlan = loadPlanFromStorage();
      const storedUserData = loadUserDataFromStorage();

      if (storedPlan) {
        setPlan(storedPlan);
      }
      if (storedUserData) {
        setUserData(storedUserData);
      }
    };

    loadData();
  }, []);

  // Save plan to both localStorage and Supabase whenever it changes
  useEffect(() => {
    if (plan) {
      savePlanToStorage(plan);

      // Async save to Supabase
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await savePlanToSupabase(plan, user.id);
        }
      })();
    }
  }, [plan]);

  /**
   * Initialize a new training plan and generate the first week
   */
  const initializePlan = async (newUserData: OnboardingData): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Save user data
      setUserData(newUserData);
      saveUserDataToStorage(newUserData);

      // Calculate total weeks until race
      const totalWeeks = calculateTotalWeeks(new Date(newUserData.goal.raceDate));

      // Generate first week
      const firstWeek = await generateWeekPlan(
        newUserData,
        1,
        totalWeeks,
        [] // No history yet
      );

      // Create the plan
      const newPlan: TrainingPlan = {
        id: `plan-${Date.now()}`,
        createdAt: new Date(),
        raceName: newUserData.goal.raceName,
        raceDate: new Date(newUserData.goal.raceDate),
        raceType: newUserData.goal.raceType,
        totalWeeks,
        currentWeekNumber: 1,
        currentWeek: firstWeek,
        completedWeeks: [],
      };

      setPlan(newPlan);

      // Save to Supabase with the proper UUID
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const supabaseId = await savePlanToSupabase(newPlan, user.id);
        if (supabaseId) {
          // Update plan with Supabase ID
          const updatedPlan = { ...newPlan, id: supabaseId };
          setPlan(updatedPlan);
        }
      }

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize plan';
      console.error('Error initializing plan:', message);
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Complete the current week and generate the next one
   */
  const generateNextWeek = async (feedback: WeekFeedback, constraints?: string): Promise<void> => {
    if (!plan || !plan.currentWeek || !userData) {
      setError('No active plan or user data found');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create completed week record
      const completedWeek: CompletedWeek = {
        weekNumber: plan.currentWeek.weekNumber,
        startDate: plan.currentWeek.startDate,
        endDate: plan.currentWeek.endDate,
        phase: plan.currentWeek.phase,
        theme: plan.currentWeek.theme,
        focus: plan.currentWeek.focus,
        totalPlannedHours: plan.currentWeek.totalPlannedHours,
        workouts: plan.currentWeek.workouts,
        summary: createWeekSummary(plan.currentWeek, feedback),
      };

      // Save feedback to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (user && plan.id) {
        // Get the week ID from Supabase
        const { data: weekRow } = await supabase
          .from('weeks')
          .select('id')
          .eq('plan_id', plan.id)
          .eq('week_number', plan.currentWeek.weekNumber)
          .single();

        if (weekRow) {
          // Mark week as completed
          await supabase
            .from('weeks')
            .update({ is_completed: true })
            .eq('id', weekRow.id);

          // Save feedback
          await supabase
            .from('week_feedback')
            .upsert({
              week_id: weekRow.id,
              overall_feeling: feedback.overallFeeling,
              physical_issues: feedback.physicalIssues || null,
              notes: feedback.notes || null,
              next_week_constraints: constraints || null,
            });
        }
      }

      const newCompletedWeeks = [...plan.completedWeeks, completedWeek];
      const nextWeekNumber = plan.currentWeekNumber + 1;

      // Check if we've reached the race
      if (nextWeekNumber > plan.totalWeeks) {
        setPlan({
          ...plan,
          currentWeekNumber: nextWeekNumber,
          currentWeek: null,
          completedWeeks: newCompletedWeeks,
        });
        return;
      }

      // Generate next week
      const nextWeek = await generateWeekPlan(
        userData,
        nextWeekNumber,
        plan.totalWeeks,
        newCompletedWeeks,
        constraints
      );

      // Update plan
      setPlan({
        ...plan,
        currentWeekNumber: nextWeekNumber,
        currentWeek: nextWeek,
        completedWeeks: newCompletedWeeks,
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate next week';
      console.error('Error generating next week:', message);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Complete current week without generating next (for manual review)
   */
  const completeCurrentWeek = (feedback: WeekFeedback): void => {
    if (!plan || !plan.currentWeek) return;

    const completedWeek: CompletedWeek = {
      weekNumber: plan.currentWeek.weekNumber,
      startDate: plan.currentWeek.startDate,
      endDate: plan.currentWeek.endDate,
      phase: plan.currentWeek.phase,
      theme: plan.currentWeek.theme,
      focus: plan.currentWeek.focus,
      totalPlannedHours: plan.currentWeek.totalPlannedHours,
      workouts: plan.currentWeek.workouts,
      summary: createWeekSummary(plan.currentWeek, feedback),
    };

    setPlan({
      ...plan,
      completedWeeks: [...plan.completedWeeks, completedWeek],
    });
  };

  /**
   * Update a workout's status and optional actual data
   */
  const updateWorkoutStatus = (
    workoutId: string,
    status: WorkoutStatus,
    actualData?: Workout['actualData']
  ): void => {
    if (!plan || !plan.currentWeek) return;

    const updatedWorkouts = plan.currentWeek.workouts.map((workout) => {
      if (workout.id === workoutId) {
        return {
          ...workout,
          status,
          actualData: actualData || workout.actualData,
        };
      }
      return workout;
    });

    setPlan({
      ...plan,
      currentWeek: {
        ...plan.currentWeek,
        workouts: updatedWorkouts,
      },
    });

    // Also update in Supabase
    (async () => {
      try {
        const updateData: Record<string, any> = { status };
        if (actualData) {
          updateData.actual_duration = actualData.duration || null;
          updateData.actual_distance = actualData.distance || null;
          updateData.actual_avg_hr = actualData.avgHR || null;
          updateData.actual_feeling = actualData.feeling || null;
          updateData.actual_rpe = actualData.rpe || null;
          updateData.actual_notes = actualData.notes || null;
        }
        await supabase
          .from('workouts')
          .update(updateData)
          .eq('id', workoutId);
      } catch (err) {
        console.error('Failed to update workout in Supabase:', err);
      }
    })();
  };

  /**
   * Get a specific workout by ID
   */
  const getWorkoutById = (workoutId: string): Workout | undefined => {
    if (!plan?.currentWeek) return undefined;
    return plan.currentWeek.workouts.find((w) => w.id === workoutId);
  };

  /**
   * Get today's workout (if any)
   */
  const getTodaysWorkout = (): Workout | undefined => {
    if (!plan?.currentWeek) return undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return plan.currentWeek.workouts.find((w) => {
      const workoutDate = new Date(w.date);
      workoutDate.setHours(0, 0, 0, 0);
      return workoutDate.getTime() === today.getTime();
    });
  };

  /**
   * Get upcoming workouts (from today forward)
   */
  const getUpcomingWorkouts = (count: number): Workout[] => {
    if (!plan?.currentWeek) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return plan.currentWeek.workouts
      .filter((w) => {
        const workoutDate = new Date(w.date);
        workoutDate.setHours(0, 0, 0, 0);
        return workoutDate.getTime() >= today.getTime() && w.type !== 'rest';
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, count);
  };

  /**
   * Get workouts for a specific date
   */
  const getWorkoutsForDate = (date: Date): Workout[] => {
    if (!plan?.currentWeek) return [];

    return plan.currentWeek.workouts.filter((workout) => {
      const workoutDate = new Date(workout.date);
      return (
        workoutDate.getDate() === date.getDate() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getFullYear() === date.getFullYear()
      );
    });
  };

  /**
   * Clear error state
   */
  const clearError = (): void => {
    setError(null);
  };

  /**
   * Reset everything
   */
  const resetPlan = (): void => {
    setPlan(null);
    setUserData(null);
    localStorage.removeItem(STORAGE_KEYS.PLAN);
    localStorage.removeItem(STORAGE_KEYS.USER_DATA);

    // Also deactivate in Supabase
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('training_plans')
          .update({ is_active: false })
          .eq('user_id', user.id)
          .eq('is_active', true);
      }
    })();
  };

  return (
    <TrainingContext.Provider
      value={{
        plan,
        currentWeek: plan?.currentWeek || null,
        isLoading,
        error,
        initializePlan,
        generateNextWeek,
        updateWorkoutStatus,
        getWorkoutById,
        getTodaysWorkout,
        getUpcomingWorkouts,
        getWorkoutsForDate,
        completeCurrentWeek,
        clearError,
        resetPlan,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useTraining(): TrainingContextType {
  const context = useContext(TrainingContext);
  if (context === undefined) {
    throw new Error('useTraining must be used within a TrainingProvider');
  }
  return context;
}