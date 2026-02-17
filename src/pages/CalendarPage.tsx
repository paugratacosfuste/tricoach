import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WorkoutCard } from '@/components/dashboard/WorkoutCard';
import { WorkoutDetailSheet } from '@/components/dashboard/WorkoutDetailSheet';
import { Calendar } from '@/components/ui/calendar';
import { useTraining } from '@/contexts/TrainingContext';
import { Workout, WorkoutType } from '@/types/training';
import { format, startOfWeek, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const workoutIcons: Record<WorkoutType, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  rest: '😴',
};

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { currentWeek, getWorkoutsForDate, updateWorkoutStatus } = useTraining();

  const selectedDateWorkouts = selectedDate ? getWorkoutsForDate(selectedDate) : [];

  const handleComplete = (workout: Workout, actualData: Workout['actualData']) => {
    updateWorkoutStatus(workout.id, 'completed', actualData);
    setSheetOpen(false);
  };

  const handleSkip = (workout: Workout) => {
    updateWorkoutStatus(workout.id, 'skipped');
    setSheetOpen(false);
  };

  const openWorkoutDetail = (workout: Workout) => {
    setSelectedWorkout(workout);
    setSheetOpen(true);
  };

  // Check if a date is a rest day (has a rest workout or is in the current week with no workouts)
  const isRestDay = (date: Date): boolean => {
    if (!currentWeek) return false;

    // Check if this date is within the current week
    const weekStart = new Date(currentWeek.startDate);
    const weekEnd = new Date(currentWeek.endDate);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);

    if (date < weekStart || date > weekEnd) return false;

    // Check if there's a rest workout on this day
    const workouts = getWorkoutsForDate(date);
    if (workouts.some(w => w.type === 'rest')) return true;

    // If no workouts scheduled for this day in the current week, it's a rest day
    return workouts.length === 0;
  };

  // Custom day render to show workout indicators
  const renderDay = (day: Date) => {
    const workouts = getWorkoutsForDate(day);
    const restDay = isRestDay(day);

    // Show rest emoji if it's a rest day with no other workouts
    if (restDay && workouts.length === 0) {
      return (
        <div className="flex gap-0.5 justify-center mt-1">
          <span className="text-xs">{workoutIcons.rest}</span>
        </div>
      );
    }

    if (workouts.length === 0) return null;

    return (
      <div className="flex gap-0.5 justify-center mt-1">
        {workouts.slice(0, 3).map((w, i) => (
          <span
            key={i}
            className={`text-xs ${w.status === 'completed' ? 'opacity-50' : ''
              } ${w.status === 'skipped' ? 'opacity-25' : ''}`}
          >
            {workoutIcons[w.type]}
          </span>
        ))}
      </div>
    );
  };

  // Check if selected date is a rest day
  const selectedIsRestDay = selectedDate ? isRestDay(selectedDate) && selectedDateWorkouts.length === 0 : false;

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Training Calendar</h1>
          <p className="text-muted-foreground mt-1">
            View and manage your training schedule
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="bg-card rounded-2xl border border-border p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                weekStartsOn={1}
                className="pointer-events-auto w-full"
                classNames={{
                  months: "w-full",
                  month: "w-full",
                  table: "w-full",
                  head_row: "flex w-full",
                  head_cell: "text-muted-foreground flex-1 font-medium text-sm",
                  row: "flex w-full mt-2",
                  cell: cn(
                    "flex-1 text-center text-sm p-0 relative focus-within:relative focus-within:z-20"
                  ),
                  day: cn(
                    "h-16 w-full p-1 font-normal rounded-lg transition-colors",
                    "hover:bg-muted focus:bg-muted"
                  ),
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary/90",
                  day_today: "ring-2 ring-primary",
                  day_outside: "opacity-50",
                }}
                components={{
                  DayContent: ({ date }) => (
                    <div className="flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {renderDay(date)}
                    </div>
                  ),
                }}
              />
            </div>
          </div>

          {/* Selected Day Details */}
          <div className="space-y-4">
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-display text-lg font-semibold mb-4">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
              </h3>

              {selectedIsRestDay ? (
                <div className="text-center py-8">
                  <span className="text-4xl mb-2 block">{workoutIcons.rest}</span>
                  <p className="text-muted-foreground font-medium">Rest Day</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Recovery is part of training!
                  </p>
                </div>
              ) : selectedDateWorkouts.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No workouts scheduled
                </p>
              ) : (
                <div className="space-y-3">
                  {selectedDateWorkouts.map((workout) => (
                    <WorkoutCard
                      key={workout.id}
                      workout={workout}
                      compact
                      onClick={() => openWorkoutDetail(workout)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="bg-card rounded-2xl border border-border p-4">
              <h4 className="font-medium text-sm mb-3">Legend</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>🏃</span>
                  <span className="text-muted-foreground">Run</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🚴</span>
                  <span className="text-muted-foreground">Bike</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🏊</span>
                  <span className="text-muted-foreground">Swim</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>💪</span>
                  <span className="text-muted-foreground">Strength</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>😴</span>
                  <span className="text-muted-foreground">Rest</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <WorkoutDetailSheet
        workout={selectedWorkout}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onComplete={selectedWorkout ? (actualData) => handleComplete(selectedWorkout, actualData) : undefined}
        onSkip={selectedWorkout ? () => handleSkip(selectedWorkout) : undefined}
      />
    </DashboardLayout>
  );
}