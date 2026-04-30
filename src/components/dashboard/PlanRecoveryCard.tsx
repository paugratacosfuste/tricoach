import { Trophy, Sparkles, RotateCcw, History, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TrainingPlan } from "@/types/training";

export interface PlanRecoveryCardProps {
  /** The user's plan, currently in a state where `currentWeek` is null. */
  readonly plan: TrainingPlan;
  /** Whether a generate-next request is in flight. Disables the CTA. */
  readonly isLoading?: boolean;
  /** Trigger generation for the missing current week. */
  readonly onGenerateNext: () => void;
  /** Wipe the plan and return the user to onboarding. Always confirmed first. */
  readonly onResetPlan: () => void;
  /** Navigate to the past-weeks history view. */
  readonly onViewHistory: () => void;
}

/**
 * Recovery UI shown when a user has a TrainingPlan but no `currentWeek`.
 * Three states are possible (see LAUNCH_PLAN — Phase 1.B Discovered debt
 * D4 for the underlying generateNextWeek write-before-call ordering bug):
 *
 *   1. Race finished     — currentWeekNumber > totalWeeks
 *   2. Mid-transition    — completed weeks exist + currentWeekNumber <= totalWeeks
 *   3. Anomalous setup   — no completed weeks AND no current week
 *
 * Race week itself (the final week of the plan, taper + shakeouts) is
 * generated as a normal `currentWeek` like any other — this card only
 * renders AFTER race week was logged complete (state 1) or BEFORE it
 * was generated (state 2 / 3).
 */
export function PlanRecoveryCard({
  plan,
  isLoading = false,
  onGenerateNext,
  onResetPlan,
  onViewHistory,
}: PlanRecoveryCardProps) {
  const completedCount = plan.completedWeeks.length;

  // State 1: race finished — every planned week was completed.
  if (plan.currentWeekNumber > plan.totalWeeks) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
          <CardTitle>Plan complete</CardTitle>
          <CardDescription>
            You finished all {plan.totalWeeks} weeks of training. Hope the race
            went well.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="w-full"
            onClick={onViewHistory}
          >
            <History className="w-4 h-4 mr-2" />
            View training history
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 3: anomalous — plan exists but no week was ever completed AND
  // no current week loaded. Most likely an `initializePlan` that persisted
  // partially. The escape hatch is a confirmed reset.
  if (completedCount === 0) {
    const handleResetClick = () => {
      const ok = window.confirm(
        "Start over? This clears your current plan. Your account stays intact.",
      );
      if (ok) onResetPlan();
    };
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <RotateCcw className="w-12 h-12 mx-auto mb-4 text-primary" />
          <CardTitle>Plan setup didn't finish</CardTitle>
          <CardDescription>
            We couldn't load your current training week. You can start over
            with a fresh plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleResetClick}>
            Start over
          </Button>
        </CardContent>
      </Card>
    );
  }

  // State 2: mid-transition gap. The next week (currentWeekNumber) failed
  // to generate; clicking re-runs generateNextWeek with default feedback.
  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
        <CardTitle>Your next training week is ready to generate</CardTitle>
        <CardDescription>
          You completed {completedCount} of {plan.totalWeeks} weeks. Generate
          week {completedCount + 1} to keep your plan moving.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          className="w-full"
          onClick={onGenerateNext}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Generate this week's plan
        </Button>
        <Button
          variant="outline"
          className="w-full"
          onClick={onViewHistory}
        >
          <History className="w-4 h-4 mr-2" />
          View training history
        </Button>
      </CardContent>
    </Card>
  );
}
