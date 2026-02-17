// src/pages/HistoryPage.tsx
//
// PURPOSE: Browse completed training weeks with workout details.
// Shows a vertical timeline of all completed weeks with expandable workout cards.

import { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { useTraining } from '@/contexts/TrainingContext';
import { CompletedWeek, Workout, WorkoutType } from '@/types/training';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    XCircle,
    Circle,
    Clock,
    MapPin,
    History,
} from 'lucide-react';

const workoutIcons: Record<WorkoutType, string> = {
    run: '🏃',
    bike: '🚴',
    swim: '🏊',
    strength: '💪',
    rest: '😴',
};

const feelingEmojis: Record<string, string> = {
    struggling: '😫',
    tired: '😕',
    okay: '😐',
    good: '🙂',
    great: '🤩',
};

function getStatusIcon(status: string) {
    switch (status) {
        case 'completed':
            return <CheckCircle2 className="w-4 h-4 text-green-500" />;
        case 'skipped':
            return <XCircle className="w-4 h-4 text-red-500" />;
        case 'partial':
            return <Circle className="w-4 h-4 text-yellow-500" />;
        default:
            return <Circle className="w-4 h-4 text-muted-foreground" />;
    }
}

function formatDateRange(start: Date, end: Date): string {
    const s = new Date(start);
    const e = new Date(end);
    const sMonth = s.toLocaleDateString('en-US', { month: 'short' });
    const eMonth = e.toLocaleDateString('en-US', { month: 'short' });
    if (sMonth === eMonth) {
        return `${sMonth} ${s.getDate()}–${e.getDate()}`;
    }
    return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`;
}

export function HistoryPage() {
    const { plan } = useTraining();
    const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

    const completedWeeks = plan?.completedWeeks || [];
    const sortedWeeks = [...completedWeeks].sort((a, b) => b.weekNumber - a.weekNumber);

    const toggleWeek = (weekNumber: number) => {
        setExpandedWeek(expandedWeek === weekNumber ? null : weekNumber);
    };

    return (
        <DashboardLayout>
            <div className="p-6 lg:p-8 max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="font-display text-2xl lg:text-3xl font-bold flex items-center gap-3">
                        <History className="w-7 h-7 text-primary" />
                        Training History
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Browse your completed training weeks
                    </p>
                </div>

                {sortedWeeks.length === 0 ? (
                    <Card>
                        <CardContent className="py-16 text-center">
                            <div className="text-5xl mb-4">📋</div>
                            <h3 className="font-semibold text-lg mb-2">No completed weeks yet</h3>
                            <p className="text-muted-foreground max-w-sm mx-auto">
                                Keep training! Your completed weeks will appear here after you finish your first week review.
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {sortedWeeks.map((week) => (
                            <WeekHistoryCard
                                key={week.weekNumber}
                                week={week}
                                isExpanded={expandedWeek === week.weekNumber}
                                onToggle={() => toggleWeek(week.weekNumber)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

// ============================================
// SUB-COMPONENTS
// ============================================

interface WeekHistoryCardProps {
    week: CompletedWeek;
    isExpanded: boolean;
    onToggle: () => void;
}

function WeekHistoryCard({ week, isExpanded, onToggle }: WeekHistoryCardProps) {
    const activeWorkouts = week.workouts.filter((w) => w.type !== 'rest');
    const completed = activeWorkouts.filter((w) => w.status === 'completed').length;
    const total = activeWorkouts.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const feeling = week.summary?.feedback?.overallFeeling;

    return (
        <Card className="overflow-hidden">
            <button
                onClick={onToggle}
                className="w-full text-left"
            >
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {/* Week number circle */}
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <span className="text-sm font-bold text-primary">W{week.weekNumber}</span>
                            </div>
                            <div>
                                <CardTitle className="text-base">{week.theme || `Week ${week.weekNumber}`}</CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {formatDateRange(week.startDate, week.endDate)} · {week.phase}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {feeling && (
                                <span className="text-xl" title={feeling}>
                                    {feelingEmojis[feeling] || '😐'}
                                </span>
                            )}
                            <Badge
                                variant={completionRate >= 80 ? 'default' : completionRate >= 50 ? 'secondary' : 'destructive'}
                            >
                                {completed}/{total}
                            </Badge>
                            {isExpanded ? (
                                <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                        </div>
                    </div>
                </CardHeader>
            </button>

            {isExpanded && (
                <CardContent className="pt-0 pb-4">
                    <div className="border-t border-border pt-4 space-y-3">
                        {/* Completion bar */}
                        <div className="flex items-center gap-3 mb-4">
                            <div className="flex-1 bg-muted rounded-full h-2">
                                <div
                                    className="bg-primary rounded-full h-2 transition-all"
                                    style={{ width: `${completionRate}%` }}
                                />
                            </div>
                            <span className="text-sm text-muted-foreground font-medium">{completionRate}%</span>
                        </div>

                        {/* Workout list */}
                        {week.workouts.map((workout) => (
                            <WorkoutHistoryItem key={workout.id} workout={workout} />
                        ))}

                        {/* Feedback summary */}
                        {week.summary?.feedback && (
                            <div className="mt-4 pt-4 border-t border-border">
                                <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Week Feedback</h4>
                                <div className="flex items-center gap-2 text-sm">
                                    <span>Feeling: {feelingEmojis[week.summary.feedback.overallFeeling] || '😐'} {week.summary.feedback.overallFeeling}</span>
                                </div>
                                {week.summary.feedback.notes && (
                                    <p className="text-sm text-muted-foreground mt-1">{week.summary.feedback.notes}</p>
                                )}
                                {week.summary.feedback.physicalIssues && week.summary.feedback.physicalIssues.length > 0 && (
                                    <div className="flex gap-1 flex-wrap mt-2">
                                        {week.summary.feedback.physicalIssues.map((issue, i) => (
                                            <Badge key={i} variant="outline" className="text-xs">
                                                {issue}
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

interface WorkoutHistoryItemProps {
    workout: Workout;
}

function WorkoutHistoryItem({ workout }: WorkoutHistoryItemProps) {
    const dateStr = new Date(workout.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
    });

    return (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
            <span className="text-xl">{workoutIcons[workout.type]}</span>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{workout.name}</span>
                    {getStatusIcon(workout.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{dateStr}</span>
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {workout.actualData?.duration || workout.duration}min
                    </span>
                    {(workout.actualData?.distance || workout.distance) && (
                        <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {workout.actualData?.distance || workout.distance}km
                        </span>
                    )}
                </div>
            </div>
            {workout.actualData && (
                <div className="text-right shrink-0">
                    {workout.actualData.rpe && (
                        <div className="text-xs text-muted-foreground">RPE {workout.actualData.rpe}/10</div>
                    )}
                    {workout.actualData.feeling && (
                        <div className="text-sm">
                            {workout.actualData.feeling === 1 ? '😫' :
                                workout.actualData.feeling === 2 ? '😕' :
                                    workout.actualData.feeling === 3 ? '😐' :
                                        workout.actualData.feeling === 4 ? '🙂' : '🤩'}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
