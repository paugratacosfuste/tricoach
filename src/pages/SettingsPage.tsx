import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useOnboarding } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTraining } from '@/contexts/TrainingContext';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Calendar, Activity, Bell, Heart, RefreshCw, Trash2, LogOut } from 'lucide-react';

// Settings keys for localStorage
const SETTINGS_KEYS = {
  WORKOUT_REMINDERS: 'tricoach-setting-workout-reminders',
  WEEKLY_SUMMARY: 'tricoach-setting-weekly-summary',
};

export function SettingsPage() {
  const { data, updateIntegrations } = useOnboarding();
  const { signOut, user } = useAuth();
  const { resetPlan } = useTraining();

  // Persisted notification settings
  const [workoutReminders, setWorkoutReminders] = useState(() =>
    localStorage.getItem(SETTINGS_KEYS.WORKOUT_REMINDERS) !== 'false'
  );
  const [weeklySummary, setWeeklySummary] = useState(() =>
    localStorage.getItem(SETTINGS_KEYS.WEEKLY_SUMMARY) !== 'false'
  );

  // Persist when toggled
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.WORKOUT_REMINDERS, String(workoutReminders));
  }, [workoutReminders]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEYS.WEEKLY_SUMMARY, String(weeklySummary));
  }, [weeklySummary]);

  const handleResetOnboarding = () => {
    if (confirm('This will reset all your data and take you back to onboarding. Are you sure?')) {
      resetPlan();
      localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 lg:p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your integrations and preferences
          </p>
        </div>

        {/* Integrations */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Integrations</h2>

          {/* Google Calendar */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Google Calendar</h3>
                  <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${data.integrations?.googleCalendar?.connected
                      ? 'bg-success/20 text-success'
                      : 'bg-muted text-muted-foreground'}
                  `}>
                    {data.integrations?.googleCalendar?.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Sync your training schedule with Google Calendar
                </p>

                {data.integrations?.googleCalendar?.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="avoid-conflicts" className="text-sm">
                        Avoid scheduling conflicts
                      </Label>
                      <Switch
                        id="avoid-conflicts"
                        checked={data.integrations?.googleCalendar?.avoidConflicts ?? true}
                        onCheckedChange={(checked) => updateIntegrations({
                          googleCalendar: {
                            ...data.integrations?.googleCalendar,
                            avoidConflicts: checked
                          },
                        })}
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline">
                    Connect Google Calendar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Strava */}
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                <Activity className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">Strava</h3>
                  <span className={`
                    text-xs px-2 py-1 rounded-full
                    ${data.integrations?.strava?.connected
                      ? 'bg-[#FC4C02]/20 text-[#FC4C02]'
                      : 'bg-muted text-muted-foreground'}
                  `}>
                    {data.integrations?.strava?.connected ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Auto-track completed workouts from Strava activities
                </p>

                {data.integrations?.strava?.connected ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="auto-complete" className="text-sm">
                        Auto-complete matching workouts
                      </Label>
                      <Switch
                        id="auto-complete"
                        checked={data.integrations?.strava?.autoComplete ?? true}
                        onCheckedChange={(checked) => updateIntegrations({
                          strava: {
                            ...data.integrations?.strava,
                            autoComplete: checked
                          },
                        })}
                      />
                    </div>
                    <Button variant="outline" size="sm">
                      Disconnect
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline">
                    Connect Strava
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Notifications */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Notifications</h2>

          <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Workout Reminders</p>
                  <p className="text-sm text-muted-foreground">Get notified before your workouts</p>
                </div>
              </div>
              <Switch
                checked={workoutReminders}
                onCheckedChange={setWorkoutReminders}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Weekly Summary</p>
                  <p className="text-sm text-muted-foreground">Receive a weekly training recap</p>
                </div>
              </div>
              <Switch
                checked={weeklySummary}
                onCheckedChange={setWeeklySummary}
              />
            </div>
          </div>
        </section>

        {/* Heart Rate Zones */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Heart Rate Zones</h2>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start gap-4 mb-4">
              <Heart className="w-5 h-5 text-primary mt-1" />
              <div>
                <p className="font-medium">Zones calculated from LTHR</p>
                <p className="text-sm text-muted-foreground">
                  Based on your Lactate Threshold HR of {data.fitness?.lthr || data.fitness?.maxHR ? Math.round((data.fitness?.maxHR || 180) * 0.85) : 170} bpm
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {[
                { zone: 1, name: 'Recovery', range: '< 80%', color: 'bg-blue-500' },
                { zone: 2, name: 'Aerobic', range: '80-90%', color: 'bg-green-500' },
                { zone: 3, name: 'Tempo', range: '90-95%', color: 'bg-yellow-500' },
                { zone: 4, name: 'Threshold', range: '95-105%', color: 'bg-orange-500' },
                { zone: 5, name: 'VO2max', range: '> 105%', color: 'bg-red-500' },
              ].map((zone) => (
                <div key={zone.zone} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${zone.color}`} />
                  <span className="text-sm font-medium w-24">Zone {zone.zone}</span>
                  <span className="text-sm text-muted-foreground flex-1">{zone.name}</span>
                  <span className="text-sm text-muted-foreground">{zone.range} LTHR</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Account */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold">Account</h2>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Sign Out</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {user?.email ? `Signed in as ${user.email}` : 'Sign out of your account'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={async () => {
                  await signOut();
                  window.location.href = '/login';
                }}
                className="shrink-0"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4">
          <h2 className="font-display text-xl font-semibold text-destructive">Danger Zone</h2>

          <div className="bg-destructive/10 rounded-2xl border border-destructive/30 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold">Reset All Data</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will delete all your training data, plans, and settings. You'll need to complete onboarding again.
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleResetOnboarding}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
