import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTraining } from '@/contexts/TrainingContext';
import { supabase } from '@/lib/supabase';
import { format, differenceInWeeks, differenceInDays } from 'date-fns';
import { Target, Calendar, Trophy, Clock, MapPin, TrendingUp, Edit3, Save, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const raceTypeLabels: Record<string, string> = {
  'marathon': 'Marathon',
  'half-marathon': 'Half Marathon',
  'sprint-triathlon': 'Sprint Triathlon',
  'olympic-triathlon': 'Olympic Triathlon',
  '70.3-ironman': 'Ironman 70.3',
  'full-ironman': 'Ironman',
};

const raceTypeOptions = [
  { value: 'marathon', label: 'Marathon' },
  { value: 'half-marathon', label: 'Half Marathon' },
  { value: 'sprint-triathlon', label: 'Sprint Triathlon' },
  { value: 'olympic-triathlon', label: 'Olympic Triathlon' },
  { value: '70.3-ironman', label: 'Ironman 70.3' },
  { value: 'full-ironman', label: 'Ironman' },
];

const priorityOptions = [
  { value: 'finish', label: 'Finish Strong' },
  { value: 'pb', label: 'Personal Best' },
  { value: 'podium', label: 'Podium Finish' },
];

const raceDistances: Record<string, { swim?: string; bike?: string; run: string }> = {
  'marathon': { run: '42.195km' },
  'half-marathon': { run: '21.1km' },
  'sprint-triathlon': { swim: '750m', bike: '20km', run: '5km' },
  'olympic-triathlon': { swim: '1.5km', bike: '40km', run: '10km' },
  '70.3-ironman': { swim: '1.9km', bike: '90km', run: '21.1km' },
  'full-ironman': { swim: '3.8km', bike: '180km', run: '42.2km' },
};

export function GoalsPage() {
  const { data, updateGoal } = useOnboarding();
  const { plan } = useTraining();
  const goal = data.goal;

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Edit form state
  const [editRaceName, setEditRaceName] = useState(goal?.raceName || '');
  const [editRaceType, setEditRaceType] = useState(goal?.raceType || '');
  const [editRaceDate, setEditRaceDate] = useState(
    goal?.raceDate ? new Date(goal.raceDate).toISOString().split('T')[0] : ''
  );
  const [editGoalTime, setEditGoalTime] = useState(goal?.goalTime || '');
  const [editPriority, setEditPriority] = useState(goal?.priority || 'finish');

  const handleStartEdit = () => {
    setEditRaceName(goal?.raceName || '');
    setEditRaceType(goal?.raceType || '');
    setEditRaceDate(goal?.raceDate ? new Date(goal.raceDate).toISOString().split('T')[0] : '');
    setEditGoalTime(goal?.goalTime || '');
    setEditPriority(goal?.priority || 'finish');
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Update context
      updateGoal({
        raceName: editRaceName,
        raceType: editRaceType as any,
        raceDate: new Date(editRaceDate),
        goalTime: editGoalTime || undefined,
        priority: editPriority as any,
      });

      // Update Supabase training plan
      if (plan?.id) {
        await supabase
          .from('training_plans')
          .update({
            race_name: editRaceName,
            race_type: editRaceType,
            race_date: editRaceDate,
            goal_time: editGoalTime || null,
            goal_priority: editPriority,
          })
          .eq('id', plan.id);
      }

      setIsEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save goal:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!goal?.raceDate) {
    return (
      <DashboardLayout>
        <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="font-display text-2xl font-bold mb-2">No Race Goal Set</h2>
            <p className="text-muted-foreground">
              Set a race goal in settings to see your training countdown.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const raceDate = new Date(goal.raceDate);
  const today = new Date();
  const weeksOut = differenceInWeeks(raceDate, today);
  const daysOut = differenceInDays(raceDate, today);
  const distances = goal.raceType ? raceDistances[goal.raceType] : null;

  // Training phases
  const phases = [
    { name: 'Base Building', weeksRange: '16+ weeks', description: 'Building aerobic foundation' },
    { name: 'Build Phase 1', weeksRange: '12-16 weeks', description: 'Increasing volume and intensity' },
    { name: 'Build Phase 2', weeksRange: '8-12 weeks', description: 'Race-specific preparation' },
    { name: 'Peak/Race-Specific', weeksRange: '4-8 weeks', description: 'High intensity, race simulation' },
    { name: 'Taper', weeksRange: '0-4 weeks', description: 'Reducing volume, maintaining intensity' },
  ];

  const getCurrentPhase = () => {
    if (weeksOut > 16) return 0;
    if (weeksOut > 12) return 1;
    if (weeksOut > 8) return 2;
    if (weeksOut > 4) return 3;
    return 4;
  };

  const currentPhaseIndex = getCurrentPhase();

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold">Race Goal</h1>
            <p className="text-muted-foreground mt-1">
              Your training journey towards race day
            </p>
          </div>
          {!isEditing && (
            <Button variant="outline" onClick={handleStartEdit}>
              <Edit3 className="w-4 h-4 mr-2" />
              Edit Goal
            </Button>
          )}
          {saveSuccess && (
            <span className="text-sm text-green-500 flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> Saved!
            </span>
          )}
        </div>

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-card rounded-2xl border-2 border-primary/30 p-6 space-y-4">
            <h3 className="font-semibold text-primary flex items-center gap-2">
              <Edit3 className="w-4 h-4" />
              Edit Race Goal
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Race Name</Label>
                <Input
                  value={editRaceName}
                  onChange={(e) => setEditRaceName(e.target.value)}
                  placeholder="e.g. Barcelona Marathon 2026"
                />
              </div>
              <div className="space-y-2">
                <Label>Race Type</Label>
                <select
                  value={editRaceType}
                  onChange={(e) => setEditRaceType(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {raceTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Race Date</Label>
                <Input
                  type="date"
                  value={editRaceDate}
                  onChange={(e) => setEditRaceDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Goal Time (optional)</Label>
                <Input
                  value={editGoalTime}
                  onChange={(e) => setEditGoalTime(e.target.value)}
                  placeholder="e.g. 3:30:00"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                >
                  {priorityOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                Save Changes
              </Button>
              <Button variant="ghost" onClick={() => setIsEditing(false)}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Race Card */}
        <div className="bg-gradient-to-br from-primary/20 via-primary/10 to-transparent rounded-3xl border border-primary/30 p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-4xl">🏁</span>
                <div>
                  <p className="text-sm text-primary font-medium">
                    {goal.raceType && raceTypeLabels[goal.raceType]}
                  </p>
                  <h2 className="font-display text-2xl lg:text-3xl font-bold">
                    {goal.raceName}
                  </h2>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 mt-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  {format(raceDate, 'EEEE, MMMM d, yyyy')}
                </div>
                {goal.goalTime && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    Target: {goal.goalTime}
                  </div>
                )}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Trophy className="w-4 h-4" />
                  {goal.priority === 'finish' ? 'Finish Strong' : ''}
                  {goal.priority === 'pb' ? 'Personal Best' : ''}
                  {goal.priority === 'podium' ? 'Podium Finish' : ''}
                </div>
              </div>
            </div>

            <div className="text-center lg:text-right">
              <div className="text-5xl lg:text-6xl font-display font-bold text-primary">
                {daysOut}
              </div>
              <p className="text-muted-foreground">days to go</p>
            </div>
          </div>
        </div>

        {/* Race Distances */}
        {distances && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {distances.swim && (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <span className="text-3xl mb-2 block">🏊</span>
                <p className="text-sm text-muted-foreground">Swim</p>
                <p className="text-2xl font-display font-bold text-swim">{distances.swim}</p>
              </div>
            )}
            {distances.bike && (
              <div className="bg-card rounded-2xl border border-border p-6 text-center">
                <span className="text-3xl mb-2 block">🚴</span>
                <p className="text-sm text-muted-foreground">Bike</p>
                <p className="text-2xl font-display font-bold text-bike">{distances.bike}</p>
              </div>
            )}
            <div className="bg-card rounded-2xl border border-border p-6 text-center">
              <span className="text-3xl mb-2 block">🏃</span>
              <p className="text-sm text-muted-foreground">Run</p>
              <p className="text-2xl font-display font-bold text-primary">{distances.run}</p>
            </div>
          </div>
        )}

        {/* Training Phases */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-display text-lg font-semibold mb-6 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Training Timeline
          </h3>

          <div className="space-y-4">
            {phases.map((phase, index) => {
              const isActive = index === currentPhaseIndex;
              const isPast = index > currentPhaseIndex;

              return (
                <div
                  key={phase.name}
                  className={`
                    flex items-start gap-4 p-4 rounded-xl transition-all
                    ${isActive ? 'bg-primary/10 border border-primary/30' : ''}
                    ${isPast ? 'opacity-50' : ''}
                  `}
                >
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center shrink-0
                    ${isActive ? 'bg-primary text-primary-foreground' : 'bg-muted'}
                  `}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{phase.name}</h4>
                      <span className="text-sm text-muted-foreground">{phase.weeksRange}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>
                    {isActive && (
                      <p className="text-sm text-primary mt-2 font-medium">
                        ← You are here ({weeksOut} weeks out)
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Countdown Progress */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-display text-lg font-semibold mb-4">Journey Progress</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Training Started</span>
              <span className="text-muted-foreground">Race Day</span>
            </div>
            <Progress
              value={Math.max(0, Math.min(100, 100 - (daysOut / 120) * 100))}
              className="h-3"
            />
            <p className="text-center text-sm text-muted-foreground mt-2">
              {Math.max(0, Math.round(100 - (daysOut / 120) * 100))}% of your training journey complete
            </p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
