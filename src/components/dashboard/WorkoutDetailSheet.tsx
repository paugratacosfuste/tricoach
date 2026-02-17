import { useState } from 'react';
import { Workout, WorkoutType } from '@/types/training';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { Clock, MapPin, Lightbulb, Check, X, ChevronDown, ChevronUp } from 'lucide-react';

const workoutIcons: Record<WorkoutType, string> = {
  run: '🏃',
  bike: '🚴',
  swim: '🏊',
  strength: '💪',
  rest: '😴',
};

const feelingEmojis = [
  { value: 1, emoji: '😫', label: 'Terrible' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '🤩', label: 'Great' },
] as const;

const rpeLabels: Record<number, string> = {
  1: 'Very Light',
  2: 'Light',
  3: 'Light',
  4: 'Moderate',
  5: 'Moderate',
  6: 'Hard',
  7: 'Hard',
  8: 'Very Hard',
  9: 'Very Hard',
  10: 'Max',
};

interface WorkoutDetailSheetProps {
  workout: Workout | null;
  open: boolean;
  onClose: () => void;
  onComplete?: (actualData: Workout['actualData']) => void;
  onSkip?: () => void;
}

export function WorkoutDetailSheet({
  workout,
  open,
  onClose,
  onComplete,
  onSkip
}: WorkoutDetailSheetProps) {
  const [showCompletionForm, setShowCompletionForm] = useState(false);
  const [actualDuration, setActualDuration] = useState<number>(0);
  const [actualDistance, setActualDistance] = useState<string>('');
  const [avgHR, setAvgHR] = useState<string>('');
  const [rpe, setRpe] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [notes, setNotes] = useState('');

  if (!workout) return null;

  const handleStartComplete = () => {
    setActualDuration(workout.duration);
    setActualDistance(workout.distance?.toString() || '');
    setAvgHR('');
    setRpe(null);
    setFeeling(3);
    setNotes('');
    setShowCompletionForm(true);
  };

  const handleSaveComplete = () => {
    if (onComplete) {
      onComplete({
        duration: actualDuration,
        distance: actualDistance ? Number(actualDistance) : undefined,
        avgHR: avgHR ? Number(avgHR) : undefined,
        feeling,
        rpe: rpe || undefined,
        notes: notes || undefined,
      });
    }
    setShowCompletionForm(false);
  };

  const handleClose = () => {
    setShowCompletionForm(false);
    onClose();
  };

  const isCompleted = workout.status === 'completed';
  const isSkipped = workout.status === 'skipped';

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto bg-background border-border">
        <SheetHeader className="space-y-4 pb-6">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{workoutIcons[workout.type]}</span>
            <div>
              <p className="text-sm text-muted-foreground">
                {format(new Date(workout.date), 'EEEE, MMMM d')}
              </p>
              <SheetTitle className="font-display text-2xl">
                {workout.name}
              </SheetTitle>
            </div>
          </div>

          <SheetDescription className="sr-only">
            Workout details for {workout.name}
          </SheetDescription>

          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-4 h-4" />
              {workout.duration}min
            </span>
            {workout.distance && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                {workout.distance}km
              </span>
            )}
            <span className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${workout.status === 'completed' ? 'bg-green-500/20 text-green-500' : ''}
              ${workout.status === 'skipped' ? 'bg-destructive/20 text-destructive' : ''}
              ${workout.status === 'planned' ? 'bg-primary/20 text-primary' : ''}
              ${workout.status === 'partial' ? 'bg-yellow-500/20 text-yellow-500' : ''}
            `}>
              {workout.status.charAt(0).toUpperCase() + workout.status.slice(1)}
            </span>
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Actual vs Planned Comparison (for completed workouts) */}
          {isCompleted && workout.actualData && (
            <section className="bg-green-500/5 rounded-xl p-4 border border-green-500/20">
              <h4 className="text-sm font-semibold text-green-500 flex items-center gap-2 mb-3">
                ✅ ACTUAL vs PLANNED
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Planned</p>
                  <p className="font-medium">{workout.duration}min{workout.distance ? ` / ${workout.distance}km` : ''}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Actual</p>
                  <p className="font-medium">
                    {workout.actualData.duration}min
                    {workout.actualData.distance ? ` / ${workout.actualData.distance}km` : ''}
                  </p>
                </div>
                {workout.actualData.avgHR && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Avg HR</p>
                    <p className="font-medium">{workout.actualData.avgHR} bpm</p>
                  </div>
                )}
                {workout.actualData.rpe && (
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">RPE</p>
                    <p className="font-medium">{workout.actualData.rpe}/10 · {rpeLabels[workout.actualData.rpe]}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Feeling</p>
                  <p className="font-medium text-lg">
                    {feelingEmojis.find(f => f.value === workout.actualData!.feeling)?.emoji || '😐'}
                    <span className="text-sm ml-1">
                      {feelingEmojis.find(f => f.value === workout.actualData!.feeling)?.label}
                    </span>
                  </p>
                </div>
              </div>
              {workout.actualData.notes && (
                <div className="mt-3 pt-3 border-t border-green-500/10">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{workout.actualData.notes}</p>
                </div>
              )}
            </section>
          )}

          {/* Purpose */}
          {workout.purpose && (
            <section className="bg-card rounded-xl p-4 border border-border">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-2">
                🎯 PURPOSE
              </h4>
              <p className="text-sm text-muted-foreground">{workout.purpose}</p>
            </section>
          )}

          {/* Description - The main workout content */}
          {workout.description && (
            <section className="bg-card rounded-xl p-4 border border-border">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                📋 WORKOUT DETAILS
              </h4>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {workout.description}
              </p>
            </section>
          )}

          {/* Coaching Tips */}
          {workout.coachingTips && workout.coachingTips.length > 0 && (
            <section className="bg-card rounded-xl p-4 border border-border">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4" />
                COACHING TIPS
              </h4>
              <ul className="space-y-2">
                {workout.coachingTips.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Completion Form */}
          {workout.status === 'planned' && showCompletionForm && (
            <section className="bg-card rounded-xl p-4 border-2 border-primary/30 space-y-4">
              <h4 className="text-sm font-semibold text-primary flex items-center gap-2">
                📝 LOG YOUR WORKOUT
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="actual-duration" className="text-xs">Duration (min)</Label>
                  <Input
                    id="actual-duration"
                    type="number"
                    value={actualDuration}
                    onChange={(e) => setActualDuration(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="actual-distance" className="text-xs">Distance (km)</Label>
                  <Input
                    id="actual-distance"
                    type="number"
                    step="0.1"
                    value={actualDistance}
                    onChange={(e) => setActualDistance(e.target.value)}
                    placeholder="—"
                    className="h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="avg-hr" className="text-xs">Average Heart Rate (optional)</Label>
                <Input
                  id="avg-hr"
                  type="number"
                  value={avgHR}
                  onChange={(e) => setAvgHR(e.target.value)}
                  placeholder="e.g. 145"
                  className="h-9"
                />
              </div>

              {/* Feeling */}
              <div className="space-y-2">
                <Label className="text-xs">How did it feel?</Label>
                <div className="flex gap-1 justify-between">
                  {feelingEmojis.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFeeling(f.value as 1 | 2 | 3 | 4 | 5)}
                      className={`
                        flex flex-col items-center gap-1 p-2 rounded-lg flex-1 transition-all
                        ${feeling === f.value
                          ? 'bg-primary/20 ring-2 ring-primary scale-105'
                          : 'bg-muted/30 hover:bg-muted/50'
                        }
                      `}
                    >
                      <span className="text-2xl">{f.emoji}</span>
                      <span className="text-[10px] text-muted-foreground">{f.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* RPE */}
              <div className="space-y-2">
                <Label className="text-xs">
                  RPE (Rate of Perceived Exertion)
                  {rpe && <span className="ml-2 text-primary">{rpe}/10 · {rpeLabels[rpe]}</span>}
                </Label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRpe(n)}
                      className={`
                        w-full h-8 rounded text-xs font-medium transition-all
                        ${rpe === n
                          ? n <= 3 ? 'bg-green-500 text-white'
                            : n <= 5 ? 'bg-yellow-500 text-white'
                              : n <= 7 ? 'bg-orange-500 text-white'
                                : 'bg-red-500 text-white'
                          : 'bg-muted/30 hover:bg-muted/50 text-muted-foreground'
                        }
                      `}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="How was it? Anything noteworthy?"
                  className="h-20 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button onClick={handleSaveComplete} className="flex-1">
                  <Check className="w-4 h-4 mr-2" />
                  Save & Complete
                </Button>
                <Button variant="ghost" onClick={() => setShowCompletionForm(false)}>
                  Cancel
                </Button>
              </div>
            </section>
          )}

          {/* Actions */}
          {workout.status === 'planned' && !showCompletionForm && (
            <div className="flex gap-3 pt-4">
              {onComplete && (
                <Button
                  onClick={handleStartComplete}
                  className="flex-1"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Mark as Done
                </Button>
              )}
              {onSkip && (
                <Button
                  onClick={onSkip}
                  variant="outline"
                >
                  <X className="w-4 h-4 mr-2" />
                  Skip
                </Button>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}