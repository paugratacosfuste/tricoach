import { Workout, WorkoutType } from '@/types/training';
import { format } from 'date-fns';
import { Clock, MapPin, Check, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const workoutIcons: Record<WorkoutType, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  rest: '😴',
};

const workoutCardClass: Record<WorkoutType, string> = {
  run: 'workout-run',
  bike: 'workout-bike',
  swim: 'workout-swim',
  strength: 'workout-strength',
  rest: 'workout-rest',
};

interface WorkoutCardProps {
  workout: Workout;
  showDate?: boolean;
  onComplete?: () => void;
  onSkip?: () => void;
  onClick?: () => void;
  compact?: boolean;
}

export function WorkoutCard({
  workout,
  showDate = false,
  onComplete,
  onSkip,
  onClick,
  compact = false
}: WorkoutCardProps) {
  const statusBadge = () => {
    switch (workout.status) {
      case 'completed':
        return <span className="text-xs px-2 py-1 rounded-full bg-success/20 text-success font-medium">Completed</span>;
      case 'skipped':
        return <span className="text-xs px-2 py-1 rounded-full bg-destructive/20 text-destructive font-medium">Skipped</span>;
      case 'partial':
        return <span className="text-xs px-2 py-1 rounded-full bg-warning/20 text-warning font-medium">Partial</span>;
      default:
        return null;
    }
  };

  const statusOpacity = workout.status === 'completed' ? 'opacity-70' : workout.status === 'skipped' ? 'opacity-50' : '';

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={`
          p-3 rounded-lg cursor-pointer transition-all hover:scale-[1.02]
          ${workoutCardClass[workout.type]}
          ${statusOpacity}
        `}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{workoutIcons[workout.type]}</span>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold truncate">{workout.name}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 font-data">
                <Clock className="w-3 h-3" />
                {workout.duration}min
              </span>
              {workout.distance && (
                <span className="flex items-center gap-1 font-data">
                  <MapPin className="w-3 h-3" />
                  {workout.distance}km
                </span>
              )}
            </div>
          </div>
          {statusBadge()}
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        p-6 rounded-xl card-base transition-all
        ${workoutCardClass[workout.type]}
        ${onClick ? 'cursor-pointer hover:scale-[1.01]' : ''}
        ${statusOpacity}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{workoutIcons[workout.type]}</span>
          <div>
            {showDate && (
              <p className="text-xs text-muted-foreground mb-1">
                {format(new Date(workout.date), 'EEEE, MMMM d')}
              </p>
            )}
            <h3 className="font-display text-lg font-semibold">{workout.name}</h3>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1 font-data">
                <Clock className="w-4 h-4" />
                {workout.duration}min
              </span>
              {workout.distance && (
                <span className="flex items-center gap-1 font-data">
                  <MapPin className="w-4 h-4" />
                  {workout.distance}km
                </span>
              )}
            </div>
          </div>
        </div>
        {statusBadge()}
      </div>

      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {workout.purpose}
      </p>

      {workout.status === 'planned' && (onComplete || onSkip) && (
        <div className="flex gap-2">
          {onComplete && (
            <Button
              onClick={(e) => { e.stopPropagation(); onComplete(); }}
              size="sm"
              className="flex-1 bg-hero-gradient hover:opacity-90 font-display font-semibold"
            >
              <Check className="w-4 h-4 mr-1" />
              Mark Done
            </Button>
          )}
          {onSkip && (
            <Button
              onClick={(e) => { e.stopPropagation(); onSkip(); }}
              variant="outline"
              size="sm"
            >
              <X className="w-4 h-4 mr-1" />
              Skip
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
