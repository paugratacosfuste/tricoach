import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { WorkoutCard } from '@/components/dashboard/WorkoutCard';
import { WorkoutDetailSheet } from '@/components/dashboard/WorkoutDetailSheet';
import { Calendar } from '@/components/ui/calendar';
import { useTraining } from '@/contexts/TrainingContext';
import { Workout, WorkoutType } from '@/types/training';
import { format, startOfWeek, isSameDay, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';

const workoutIcons: Record<WorkoutType, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  rest: '😴',
};

// Draggable workout card wrapper
function DraggableWorkoutCard({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  const isDraggable = workout.status === 'planned' && workout.type !== 'rest';
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: workout.id,
    data: { workout },
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="relative"
    >
      {isDraggable && (
        <div
          {...listeners}
          {...attributes}
          className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      )}
      <div className={isDraggable ? 'pl-6' : ''}>
        <WorkoutCard
          workout={workout}
          compact
          onClick={onClick}
        />
      </div>
    </div>
  );
}

// Droppable day cell for the calendar
function DroppableDay({ date, children, isOver }: { date: Date; children: React.ReactNode; isOver: boolean }) {
  const dateStr = date.toISOString().split('T')[0];
  const { setNodeRef } = useDroppable({ id: `day-${dateStr}`, data: { date } });

  return (
    <div ref={setNodeRef} className={`flex flex-col items-center ${isOver ? 'bg-primary/20 rounded-lg' : ''}`}>
      {children}
    </div>
  );
}

export function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draggedWorkout, setDraggedWorkout] = useState<Workout | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ workout: Workout; targetDate: Date } | null>(null);

  const { currentWeek, getWorkoutsForDate, updateWorkoutStatus, rescheduleWorkout } = useTraining();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 10 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const workout = event.active.data.current?.workout as Workout | undefined;
    if (workout) setDraggedWorkout(workout);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggedWorkout(null);
    const { active, over } = event;
    if (!over || !currentWeek) return;

    const workout = active.data.current?.workout as Workout | undefined;
    if (!workout) return;

    const overId = over.id as string;
    if (!overId.startsWith('day-')) return;

    const targetDateStr = overId.replace('day-', '');
    const targetDate = new Date(targetDateStr + 'T00:00:00');

    // Don't move if same day
    if (isSameDay(new Date(workout.date), targetDate)) return;

    // Only allow drops within the current week
    const weekStart = new Date(currentWeek.startDate);
    const weekEnd = new Date(currentWeek.endDate);
    weekStart.setHours(0, 0, 0, 0);
    weekEnd.setHours(23, 59, 59, 999);
    if (targetDate < weekStart || targetDate > weekEnd) return;

    // Show confirmation dialog
    setPendingDrop({ workout, targetDate });
  };

  const handleConfirmDrop = () => {
    if (pendingDrop) {
      rescheduleWorkout(pendingDrop.workout.id, pendingDrop.targetDate);
      setPendingDrop(null);
    }
  };

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
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="space-y-6">
          <div className="mb-6">
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Training Calendar</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your training schedule. Drag workouts to reschedule.
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
                    DayContent: ({ date }) => {
                      const dateStr = date.toISOString().split('T')[0];
                      const { setNodeRef, isOver } = useDroppable({
                        id: `day-${dateStr}`,
                        data: { date },
                      });
                      return (
                        <div
                          ref={setNodeRef}
                          className={`flex flex-col items-center w-full h-full ${
                            isOver && draggedWorkout ? 'bg-primary/20 rounded-lg ring-2 ring-primary/50' : ''
                          }`}
                        >
                          <span>{date.getDate()}</span>
                          {renderDay(date)}
                        </div>
                      );
                    },
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
                      <DraggableWorkoutCard
                        key={workout.id}
                        workout={workout}
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

        {/* Drag overlay - shows the workout being dragged */}
        <DragOverlay>
          {draggedWorkout ? (
            <div className="bg-card border border-primary rounded-lg p-3 shadow-lg opacity-90 max-w-[250px]">
              <div className="flex items-center gap-2">
                <span className="text-xl">{workoutIcons[draggedWorkout.type]}</span>
                <div>
                  <p className="font-display font-semibold text-sm truncate">{draggedWorkout.name}</p>
                  <p className="text-xs text-muted-foreground">{draggedWorkout.duration}min</p>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Drag reschedule confirmation dialog */}
      <AlertDialog open={!!pendingDrop} onOpenChange={(open) => !open && setPendingDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reschedule Workout</AlertDialogTitle>
            <AlertDialogDescription>
              Move "{pendingDrop?.workout.name}" from{' '}
              {pendingDrop ? format(new Date(pendingDrop.workout.date), 'EEEE') : ''} to{' '}
              {pendingDrop ? format(pendingDrop.targetDate, 'EEEE, MMMM d') : ''}?
              This may affect your weekly training balance.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDrop}>
              Move Workout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorkoutDetailSheet
        workout={selectedWorkout}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onComplete={selectedWorkout ? (actualData) => handleComplete(selectedWorkout, actualData) : undefined}
        onSkip={selectedWorkout ? () => handleSkip(selectedWorkout) : undefined}
        onReschedule={selectedWorkout ? (newDate) => {
          rescheduleWorkout(selectedWorkout.id, newDate);
          setSheetOpen(false);
        } : undefined}
        currentWeekStart={currentWeek?.startDate}
      />
    </DashboardLayout>
  );
}