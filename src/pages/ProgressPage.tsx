import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useTraining } from '@/contexts/TrainingContext';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { TrendingUp, Target, Award, Calendar } from 'lucide-react';

export function ProgressPage() {
  const { plan, currentWeek } = useTraining();

  // Calculate stats from completed weeks + current week
  const allWeeks = [
    ...(plan?.completedWeeks || []),
    ...(currentWeek ? [currentWeek] : []),
  ];

  // Calculate weekly data for charts
  const weeklyData = allWeeks.map((week) => {
    const completed = week.workouts.filter(w => w.status === 'completed').length;
    const total = week.workouts.filter(w => w.type !== 'rest').length;
    const runDistance = week.workouts
      .filter(w => w.type === 'run')
      .reduce((sum, w) => sum + (w.distance || 0), 0);

    return {
      name: `Week ${week.weekNumber}`,
      completed,
      total,
      hours: week.totalPlannedHours || 0,
      runKm: runDistance,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  // Calculate overall stats
  const totalWorkouts = allWeeks.reduce((sum, week) =>
    sum + week.workouts.filter(w => w.type !== 'rest').length, 0
  );
  const completedWorkouts = allWeeks.reduce((sum, week) =>
    sum + week.workouts.filter(w => w.status === 'completed').length, 0
  );
  const overallProgress = totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;

  // Calculate streak (simplified - counts consecutive completed days)
  const calculateStreak = (): number => {
    if (!currentWeek) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Sort workouts by date descending
    const sortedWorkouts = [...currentWeek.workouts]
      .filter(w => w.type !== 'rest')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    for (const workout of sortedWorkouts) {
      const workoutDate = new Date(workout.date);
      workoutDate.setHours(0, 0, 0, 0);
      if (workoutDate > today) continue;
      if (workout.status === 'completed') {
        streak++;
      } else if (workout.status === 'skipped' || workoutDate < today) {
        break;
      }
    }
    return streak;
  };

  const streak = calculateStreak();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl lg:text-3xl font-bold">Progress & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Track your training consistency and improvement
          </p>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Completion Rate</span>
              <TrendingUp className="w-4 h-4 text-primary" />
            </div>
            <div className="text-3xl font-display font-bold">
              {Math.round(overallProgress)}%
            </div>
            <Progress value={overallProgress} className="h-1.5 mt-2" />
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Workouts Done</span>
              <Target className="w-4 h-4 text-cyan-500" />
            </div>
            <div className="text-3xl font-display font-bold">
              {completedWorkouts}
              <span className="text-lg text-muted-foreground font-normal">/{totalWorkouts}</span>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Current Streak</span>
              <Award className="w-4 h-4 text-yellow-500" />
            </div>
            <div className="text-3xl font-display font-bold">
              {streak} <span className="text-lg text-muted-foreground font-normal">days</span>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Training Phase</span>
              <Calendar className="w-4 h-4 text-blue-500" />
            </div>
            <div className="text-xl font-display font-bold">
              {currentWeek?.phase || 'Not Started'}
            </div>
          </div>
        </div>

        {/* Charts */}
        {weeklyData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Weekly Completion */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-display text-lg font-semibold mb-6">Weekly Completion Rate</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyData}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Bar
                      dataKey="completionRate"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name="Completion %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Training Volume */}
            <div className="bg-card rounded-2xl border border-border p-6">
              <h3 className="font-display text-lg font-semibold mb-6">Training Volume (Hours)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData}>
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="hours"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                      name="Hours"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Breakdown */}
        <div className="bg-card rounded-2xl border border-border p-6">
          <h3 className="font-display text-lg font-semibold mb-6">Weekly Breakdown</h3>
          {allWeeks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No training data yet. Complete your first week to see progress!
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Week</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Theme</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Completed</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Hours</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Run Distance</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {allWeeks.map((week, index) => {
                    const completed = week.workouts.filter(w => w.status === 'completed').length;
                    const total = week.workouts.filter(w => w.type !== 'rest').length;
                    const progress = total > 0 ? (completed / total) * 100 : 0;
                    const runDistance = week.workouts
                      .filter(w => w.type === 'run')
                      .reduce((sum, w) => sum + (w.distance || 0), 0);

                    return (
                      <tr key={index} className="border-b border-border/50">
                        <td className="py-4 px-4 font-medium">Week {week.weekNumber}</td>
                        <td className="py-4 px-4 text-muted-foreground">{week.theme}</td>
                        <td className="py-4 px-4">{completed}/{total}</td>
                        <td className="py-4 px-4">{week.totalPlannedHours || 0}h</td>
                        <td className="py-4 px-4">{runDistance}km</td>
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2">
                            <Progress value={progress} className="h-2 w-24" />
                            <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}