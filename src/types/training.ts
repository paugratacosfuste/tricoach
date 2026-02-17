// src/types/training.ts
//
// PURPOSE: Type definitions for the entire app.
// This defines the shape of all our data.

// ============================================
// BASIC TYPES
// ============================================

export type RaceType =
  | 'marathon'
  | 'half-marathon'
  | 'olympic-triathlon'
  | 'sprint-triathlon'
  | '70.3-ironman'
  | 'full-ironman'
  | 'custom';

export type FitnessLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';
export type SwimLevel = 'cant-swim' | 'learning' | 'comfortable' | 'competitive';
export type GoalPriority = 'finish' | 'pb' | 'podium';
export type WorkoutType = 'swim' | 'bike' | 'run' | 'strength' | 'rest';
export type WorkoutStatus = 'planned' | 'completed' | 'skipped' | 'partial';
export type TimeSlot = 'morning' | 'midday' | 'evening';
export type Duration = '30min' | '45min' | '60min' | '90min' | '2h' | '2h30' | '3h+';
export type WeekFeeling = 'struggling' | 'tired' | 'okay' | 'good' | 'great';

// ============================================
// USER PROFILE & ONBOARDING
// ============================================

export interface UserProfile {
  firstName: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer-not-to-say';
  weight: number;
  height: number;
}

export interface FitnessAssessment {
  fitnessLevel: FitnessLevel;
  lthr: number;
  thresholdPace: string;
  maxHR: number;
  ftp?: number;
  swimLevel: SwimLevel;
}

export interface RaceGoal {
  raceType: RaceType;
  raceName: string;
  raceDate: Date;
  goalTime?: string;
  priority: GoalPriority;
  customDistances?: {
    swim?: number;
    bike?: number;
    run: number;
  };
}

export interface DayAvailability {
  available: boolean;
  timeSlots: TimeSlot[];
  maxDuration: Duration;
  longSession?: boolean;
}

export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
  weeklyHoursTarget: string;
}

export interface Integrations {
  googleCalendar: {
    connected: boolean;
    readCalendar?: string;
    writeCalendar?: string;
    avoidConflicts: boolean;
  };
  strava: {
    connected: boolean;
    autoComplete: boolean;
  };
}

export interface OnboardingData {
  profile: UserProfile;
  fitness: FitnessAssessment;
  goal: RaceGoal;
  availability: WeeklyAvailability;
  integrations: Integrations;
}

// ============================================
// WORKOUT TYPES
// ============================================

export interface WorkoutSegment {
  name: string;
  duration: string;
  description: string;
  targetHR?: { min: number; max: number };
  targetPace?: string;
  targetPower?: { min: number; max: number };
}

export interface Workout {
  id: string;
  date: Date;
  type: WorkoutType;
  name: string;
  duration: number; // minutes
  distance?: number; // km
  description: string;
  purpose: string;
  structure: WorkoutSegment[];
  heartRateGuidance: string;
  paceGuidance: string;
  coachingTips: string[];
  adaptationNotes: string;
  status: WorkoutStatus;
  actualData?: {
    duration: number;
    distance?: number;
    avgHR?: number;
    feeling: 1 | 2 | 3 | 4 | 5;
    rpe?: number; // 1-10 Rate of Perceived Exertion
    notes?: string;
  };
}

// ============================================
// WEEK TYPES
// ============================================

export interface WeekPlan {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  theme: string;
  focus: string;
  phase: string;
  totalPlannedHours: number;
  isRecoveryWeek: boolean;
  workouts: Workout[];
}

// Summary of a key workout (for history context)
export interface KeyWorkoutSummary {
  name: string;
  type: WorkoutType;
  completed: boolean;
  notes?: string;
}

// User feedback at end of week
export interface WeekFeedback {
  overallFeeling: WeekFeeling;
  physicalIssues: string[];
  notes: string;
  nextWeekConstraints?: string; // "busy work week", "traveling", etc.
}

// Compact summary for Claude context
export interface WeekSummary {
  weekNumber: number;
  phase: string;
  theme: string;
  plannedHours: number;
  completedHours: number;
  completionRate: number;
  keyWorkouts: KeyWorkoutSummary[];
  feedback: WeekFeedback;
}

// Full completed week data (stored locally)
export interface CompletedWeek {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  phase: string;
  theme: string;
  focus: string;
  totalPlannedHours: number;
  workouts: Workout[];
  summary: WeekSummary;
}

// ============================================
// TRAINING PLAN (Main Data Structure)
// ============================================

export interface TrainingPlan {
  id: string;
  createdAt: Date;

  // Race info
  raceName: string;
  raceDate: Date;
  raceType: RaceType;
  totalWeeks: number;

  // Current state
  currentWeekNumber: number;
  currentWeek: WeekPlan | null;

  // History
  completedWeeks: CompletedWeek[];
}

// ============================================
// HELPER TYPES
// ============================================

export interface HeartRateZones {
  zone1: { min: number; max: number; name: string }; // Recovery
  zone2: { min: number; max: number; name: string }; // Aerobic
  zone3: { min: number; max: number; name: string }; // Tempo
  zone4: { min: number; max: number; name: string }; // Threshold
  zone5: { min: number; max: number; name: string }; // VO2max
}

export function calculateHRZones(lthr: number): HeartRateZones {
  return {
    zone1: { min: Math.round(lthr * 0.68), max: Math.round(lthr * 0.73), name: 'Recovery' },
    zone2: { min: Math.round(lthr * 0.73), max: Math.round(lthr * 0.80), name: 'Aerobic' },
    zone3: { min: Math.round(lthr * 0.80), max: Math.round(lthr * 0.87), name: 'Tempo' },
    zone4: { min: Math.round(lthr * 0.87), max: Math.round(lthr * 0.93), name: 'Threshold' },
    zone5: { min: Math.round(lthr * 0.93), max: Math.round(lthr * 1.05), name: 'VO2max' },
  };
}

export function calculateTrainingPhase(currentWeek: number, totalWeeks: number): string {
  const weeksRemaining = totalWeeks - currentWeek;

  if (weeksRemaining <= 1) return 'Race Week';
  if (weeksRemaining <= 3) return 'Taper';
  if (weeksRemaining <= 6) return 'Peak';
  if (weeksRemaining <= 10) return 'Build 2';
  if (weeksRemaining <= 14) return 'Build 1';
  return 'Base';
}

export function isRecoveryWeek(weekNumber: number): boolean {
  // Every 4th week is a recovery/deload week
  return weekNumber % 4 === 0;
}