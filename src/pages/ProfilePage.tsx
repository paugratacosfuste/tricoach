import { useState, useRef } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useTraining } from '@/contexts/TrainingContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { User, Activity, Target, Heart, Gauge, Save, Loader2, CheckCircle2 } from 'lucide-react';

const fitnessLevelLabels: Record<string, string> = {
  'beginner': 'Beginner',
  'intermediate': 'Intermediate',
  'advanced': 'Advanced',
  'elite': 'Elite',
};

const swimLevelLabels: Record<string, string> = {
  'cant-swim': "Can't swim",
  'learning': 'Learning',
  'comfortable': 'Comfortable',
  'competitive': 'Competitive',
};

export function ProfilePage() {
  const { data, updateProfile, updateFitness } = useOnboarding();
  const { plan, regenerateCurrentWeek, isLoading: isRegenerating } = useTraining();
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showRegenDialog, setShowRegenDialog] = useState(false);

  // Snapshot of performance-affecting fields at mount/last save
  const originalFitness = useRef({
    maxHR: data.fitness?.maxHR,
    lthr: data.fitness?.lthr,
    thresholdPace: data.fitness?.thresholdPace,
    ftp: data.fitness?.ftp,
    fitnessLevel: data.fitness?.fitnessLevel,
  });

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: data.profile?.firstName || null,
          age: data.profile?.age || null,
          gender: data.profile?.gender || null,
          weight: data.profile?.weight || null,
          height: data.profile?.height || null,
          fitness_level: data.fitness?.fitnessLevel || null,
          lthr: data.fitness?.lthr || null,
          threshold_pace: data.fitness?.thresholdPace || null,
          max_hr: data.fitness?.maxHR || null,
          ftp: data.fitness?.ftp || null,
          swim_level: data.fitness?.swimLevel || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      // Check if performance-affecting fields changed
      const fitnessChanged =
        data.fitness?.maxHR !== originalFitness.current.maxHR ||
        data.fitness?.lthr !== originalFitness.current.lthr ||
        data.fitness?.thresholdPace !== originalFitness.current.thresholdPace ||
        data.fitness?.ftp !== originalFitness.current.ftp ||
        data.fitness?.fitnessLevel !== originalFitness.current.fitnessLevel;

      // Update snapshot
      originalFitness.current = {
        maxHR: data.fitness?.maxHR,
        lthr: data.fitness?.lthr,
        thresholdPace: data.fitness?.thresholdPace,
        ftp: data.fitness?.ftp,
        fitnessLevel: data.fitness?.fitnessLevel,
      };

      if (fitnessChanged && plan?.currentWeek) {
        setShowRegenDialog(true);
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Manage your personal information and fitness metrics
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-hero-gradient rounded-2xl flex items-center justify-center">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold">{data.profile?.firstName || 'Athlete'}</h2>
              <p className="text-muted-foreground">
                {data.fitness?.fitnessLevel && fitnessLevelLabels[data.fitness.fitnessLevel]} Athlete
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={data.profile?.firstName || ''}
                onChange={(e) => updateProfile({ firstName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">Age</Label>
              <Input
                id="age"
                type="number"
                value={data.profile?.age || ''}
                onChange={(e) => updateProfile({ age: parseInt(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={data.profile?.weight || ''}
                onChange={(e) => updateProfile({ weight: parseFloat(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                value={data.profile?.height || ''}
                onChange={(e) => updateProfile({ height: parseInt(e.target.value) || undefined })}
              />
            </div>
          </div>
        </div>

        {/* Fitness Metrics */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-display text-lg font-semibold mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Fitness Metrics
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-destructive" />
                  <span className="text-sm">Max Heart Rate</span>
                </div>
                <span className="font-semibold">{data.fitness?.maxHR || '—'} bpm</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Heart className="w-5 h-5 text-primary" />
                  <span className="text-sm">Lactate Threshold HR</span>
                </div>
                <span className="font-semibold">{data.fitness?.lthr || '—'} bpm</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Gauge className="w-5 h-5 text-bike" />
                  <span className="text-sm">Cycling FTP</span>
                </div>
                <span className="font-semibold">{data.fitness?.ftp || '—'} watts</span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="text-sm">Threshold Pace</span>
                </div>
                <span className="font-semibold">{data.fitness?.thresholdPace || '—'} /km</span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-success" />
                  <span className="text-sm">Fitness Level</span>
                </div>
                <span className="font-semibold">
                  {data.fitness?.fitnessLevel ? fitnessLevelLabels[data.fitness.fitnessLevel] : '—'}
                </span>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🏊</span>
                  <span className="text-sm">Swimming Level</span>
                </div>
                <span className="font-semibold">
                  {data.fitness?.swimLevel ? swimLevelLabels[data.fitness.swimLevel] : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxHR">Max Heart Rate (bpm)</Label>
              <Input
                id="maxHR"
                type="number"
                value={data.fitness?.maxHR || ''}
                onChange={(e) => updateFitness({ maxHR: parseInt(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lthr">Lactate Threshold HR (bpm)</Label>
              <Input
                id="lthr"
                type="number"
                value={data.fitness?.lthr || ''}
                onChange={(e) => updateFitness({ lthr: parseInt(e.target.value) || undefined })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="thresholdPace">Threshold Pace (min:sec/km)</Label>
              <Input
                id="thresholdPace"
                value={data.fitness?.thresholdPace || ''}
                onChange={(e) => updateFitness({ thresholdPace: e.target.value })}
                placeholder="5:00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ftp">Cycling FTP (watts)</Label>
              <Input
                id="ftp"
                type="number"
                value={data.fitness?.ftp || ''}
                onChange={(e) => updateFitness({ ftp: parseInt(e.target.value) || undefined })}
              />
            </div>
          </div>

          <Button
            className="mt-6 bg-hero-gradient hover:opacity-90"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <AlertDialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update Training Plan?</AlertDialogTitle>
            <AlertDialogDescription>
              You've updated fitness metrics that affect your training zones and intensities.
              Would you like to regenerate your current week's plan to reflect these changes?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 3000);
            }}>
              Keep Current Plan
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              regenerateCurrentWeek('Fitness metrics updated - adjust training zones and intensities accordingly');
              setShowRegenDialog(false);
              setSaveSuccess(true);
              setTimeout(() => setSaveSuccess(false), 3000);
            }}>
              Regenerate Plan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
