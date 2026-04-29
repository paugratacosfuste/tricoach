// src/pages/Dashboard.tsx
//
// PURPOSE: Main dashboard showing current week's training.
// Displays today's workout, weekly overview, and upcoming sessions.
// Includes the "Complete Week" button to trigger week review.

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTraining } from '@/contexts/TrainingContext';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WorkoutDetailSheet } from '@/components/dashboard/WorkoutDetailSheet';
import { WeekReview } from '@/components/WeekReview';
import { RegeneratePlanDialog } from '@/components/RegeneratePlanDialog';
import { WeekFeedback, Workout, WorkoutType } from '@/types/training';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Circle,
  Trophy,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

// ============================================
// CONSTANTS - Match Calendar page icons
// ============================================

const workoutIcons: Record<WorkoutType, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  rest: '😴',
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function getWorkoutIcon(type: WorkoutType) {
  return <span className="text-xl">{workoutIcons[type] || '⚪'}</span>;
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-success" />;
    case 'skipped':
      return <XCircle className="w-4 h-4 text-destructive" />;
    default:
      return <Circle className="w-4 h-4 text-muted-foreground" />;
  }
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(date: Date): boolean {
  const today = new Date();
  const d = new Date(date);
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

// ============================================
// COMPONENT
// ============================================

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    plan,
    currentWeek,
    isLoading,
    error,
    clearError,
    updateWorkoutStatus,
    rescheduleWorkout,
    regenerateCurrentWeek,
    getTodaysWorkout,
    getUpcomingWorkouts,
    generateNextWeek,
  } = useTraining();

  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegenerateOpen, setIsRegenerateOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Workout detail sheet state
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [isWorkoutSheetOpen, setIsWorkoutSheetOpen] = useState(false);

  // Handle week review submission
  const handleWeekReviewSubmit = async (feedback: WeekFeedback, constraints?: string) => {
    setIsGenerating(true);
    try {
      await generateNextWeek(feedback, constraints);
      setIsReviewOpen(false);
    } catch (err) {
      console.error('Failed to generate next week:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle workout click - open detail sheet
  const handleWorkoutClick = (workout: Workout) => {
    setSelectedWorkout(workout);
    setIsWorkoutSheetOpen(true);
  };

  // Handle workout complete from sheet (receives actual data from completion form)
  const handleWorkoutComplete = (workout: Workout, actualData: Workout['actualData']) => {
    updateWorkoutStatus(workout.id, 'completed', actualData);
    setIsWorkoutSheetOpen(false);
  };

  // Handle workout skip from sheet
  const handleWorkoutSkip = (workout: Workout) => {
    updateWorkoutStatus(workout.id, 'skipped');
    setIsWorkoutSheetOpen(false);
  };

  // Handle plan change request
  const handleRegeneratePlan = async (comment: string) => {
    setIsRegenerating(true);
    try {
      await regenerateCurrentWeek(comment);
      setIsRegenerateOpen(false);
    } catch (err) {
      console.error('Failed to regenerate plan:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Loading state
  if (isLoading && !currentWeek) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Generating your training plan...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // No plan state
  if (!plan || !currentWeek) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Card className="max-w-md">
            <CardHeader className="text-center">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
              <CardTitle>Welcome to TriCoach AI</CardTitle>
              <CardDescription>
                Let's set up your personalized training plan to reach your goals.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate('/')}>
                Get Started
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate week stats
  const totalWorkouts = currentWeek.workouts.filter((w) => w.type !== 'rest').length;
  const completedWorkouts = currentWeek.workouts.filter((w) => w.status === 'completed').length;
  const completionRate = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
  const todaysWorkout = getTodaysWorkout();
  const upcomingWorkouts = getUpcomingWorkouts(5);
  const weeksUntilRace = plan.totalWeeks - plan.currentWeekNumber;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              <span className="text-sm">{error}</span>
            </div>
            <Button variant="ghost" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Header */}
        <div className="hero-gradient rounded-2xl p-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="font-display text-2xl font-bold">
              Week {currentWeek.weekNumber} of {plan.totalWeeks}
            </h1>
            <span className="phase-badge phase-build">
              {currentWeek.phase}
            </span>
          </div>
          <p className="text-muted-foreground">{currentWeek.theme}</p>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-data">{weeksUntilRace}</span> weeks until {plan.raceName}
          </p>
        </div>

        {/* Week Progress */}
        <Card className="card-base">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-display font-semibold">Week Progress</span>
              <span className="text-sm text-muted-foreground font-data">
                {completedWorkouts}/{totalWorkouts} workouts
              </span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-2xl font-display font-bold font-data">{currentWeek.totalPlannedHours}h</div>
                <div className="text-xs text-muted-foreground">Planned this week</div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-display font-bold font-data">{completionRate}%</div>
                <div className="text-xs text-muted-foreground">Completed</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Workout */}
        {todaysWorkout && (
          <Card className="card-elevated border-primary/30 shadow-glow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  {getWorkoutIcon(todaysWorkout.type)}
                  Today's Workout
                </CardTitle>
                <Badge
                  variant={
                    todaysWorkout.status === 'completed'
                      ? 'default'
                      : todaysWorkout.status === 'skipped'
                        ? 'destructive'
                        : 'outline'
                  }
                >
                  {todaysWorkout.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="font-display font-semibold text-lg mb-2">{todaysWorkout.name}</h3>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span className="flex items-center gap-1 font-data">
                  <Clock className="w-4 h-4" />
                  {todaysWorkout.duration}min
                </span>
                {todaysWorkout.distance && (
                  <span className="flex items-center gap-1 font-data">
                    <MapPin className="w-4 h-4" />
                    {todaysWorkout.distance}km
                  </span>
                )}
              </div>

              {/* Purpose */}
              <p className="text-sm text-muted-foreground mb-4">{todaysWorkout.purpose}</p>

              {/* Description */}
              <div className="bg-muted/50 rounded-lg p-4 mb-4">
                <p className="text-sm whitespace-pre-line">{todaysWorkout.description}</p>
              </div>

              {/* Coaching Tips */}
              {todaysWorkout.coachingTips && todaysWorkout.coachingTips.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-display font-medium mb-2">💡 Coaching Tips</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {todaysWorkout.coachingTips.map((tip, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              {todaysWorkout.status === 'planned' && (
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => updateWorkoutStatus(todaysWorkout.id, 'completed')}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Complete
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => updateWorkoutStatus(todaysWorkout.id, 'skipped')}
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Skip
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* No workout today */}
        {!todaysWorkout && (
          <Card className="mb-6 bg-muted/30">
            <CardContent className="py-8 text-center">
              <div className="text-4xl mb-2">🧘</div>
              <h3 className="font-semibold mb-1">Rest Day</h3>
              <p className="text-sm text-muted-foreground">
                Recovery is part of training. Use today to rest and prepare for tomorrow.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Upcoming Workouts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Upcoming This Week</CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No more workouts scheduled this week.
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingWorkouts.map((workout) => (
                  <WorkoutListItem
                    key={workout.id}
                    workout={workout}
                    onClick={() => handleWorkoutClick(workout)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Week Actions */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                View Full Calendar
              </Button>
              <Button
                className="flex-1"
                onClick={() => setIsReviewOpen(true)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Complete Week & Generate Next
              </Button>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-2 text-muted-foreground"
              onClick={() => setIsRegenerateOpen(true)}
              disabled={isLoading || isRegenerating}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Request Plan Change
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">
              Complete your week review to get a personalized plan for next week.
            </p>
          </CardContent>
        </Card>

        {/* Week Review Modal */}
        <WeekReview
          isOpen={isReviewOpen}
          onClose={() => setIsReviewOpen(false)}
          onSubmit={handleWeekReviewSubmit}
          currentWeek={currentWeek}
          isLoading={isGenerating}
        />

        {/* Plan Change Request Dialog */}
        <RegeneratePlanDialog
          isOpen={isRegenerateOpen}
          onClose={() => setIsRegenerateOpen(false)}
          onSubmit={handleRegeneratePlan}
          isLoading={isRegenerating}
        />

        {/* Workout Detail Sheet */}
        <WorkoutDetailSheet
          workout={selectedWorkout}
          open={isWorkoutSheetOpen}
          onClose={() => setIsWorkoutSheetOpen(false)}
          onComplete={selectedWorkout ? (actualData) => handleWorkoutComplete(selectedWorkout, actualData) : undefined}
          onSkip={selectedWorkout ? () => handleWorkoutSkip(selectedWorkout) : undefined}
          onReschedule={selectedWorkout ? (newDate) => {
            rescheduleWorkout(selectedWorkout.id, newDate);
            setIsWorkoutSheetOpen(false);
          } : undefined}
          currentWeekStart={currentWeek?.startDate}
        />
      </div>
    </DashboardLayout>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface WorkoutListItemProps {
  workout: Workout;
  onClick: () => void;
}

function WorkoutListItem({ workout, onClick }: WorkoutListItemProps) {
  const isWorkoutToday = isToday(workout.date);

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-muted/50 ${isWorkoutToday ? 'border-primary/50 bg-primary/5' : 'border-border'
        }`}
    >
      <div className="flex items-center gap-3">
        {getWorkoutIcon(workout.type)}
        <div className="text-left">
          <div className="font-display font-medium flex items-center gap-2">
            {workout.name}
            {isWorkoutToday && (
              <Badge variant="outline" className="text-xs">
                Today
              </Badge>
            )}
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <span>{formatDate(workout.date)}</span>
            <span>•</span>
            <span className="font-data">{workout.duration}min</span>
            {workout.distance && (
              <>
                <span>•</span>
                <span className="font-data">{workout.distance}km</span>
              </>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusIcon(workout.status)}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </button>
  );
}