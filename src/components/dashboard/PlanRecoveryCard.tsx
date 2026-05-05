import { useState } from "react";
import { Trophy, Sparkles, RotateCcw, History, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  /**
   * Optional: start a fresh plan for a new race while keeping the user's
   * fitness profile. Only rendered in the race-complete state. (D2)
   */
  readonly onStartNewPlan?: () => void;
}

/**
 * Recovery UI shown when a user has a TrainingPlan but no `currentWeek`.
 * Three states are possible (see LAUNCH_PLAN — Phase 1.B Discovered debt
 * D1 for the underlying generateNextWeek write-before-call ordering — now
 * resolved Wave 1 2026-05-04):
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
  onStartNewPlan,
}: PlanRecoveryCardProps) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const completedCount = plan.completedWeeks.length;

  // State 1: race finished — every planned week was completed.
  if (plan.currentWeekNumber > plan.totalWeeks) {
    return (
      <Card className="max-w-md mx-auto" role="status" aria-live="polite">
        <CardHeader className="text-center">
          <Trophy className="w-12 h-12 mx-auto mb-4 text-primary" />
          <CardTitle>Plan complete</CardTitle>
          <CardDescription>
            You finished all {plan.totalWeeks} weeks of training. Hope the race
            went well.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {onStartNewPlan && (
            <Button className="w-full" onClick={onStartNewPlan}>
              <Plus className="w-4 h-4 mr-2" />
              Start a new plan
            </Button>
          )}
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
  // partially. The escape hatch is a confirmed reset via shadcn AlertDialog
  // (D3 — replaces native window.confirm).
  if (completedCount === 0) {
    return (
      <Card className="max-w-md mx-auto" role="status" aria-live="polite">
        <CardHeader className="text-center">
          <RotateCcw className="w-12 h-12 mx-auto mb-4 text-primary" />
          <CardTitle>Plan setup didn't finish</CardTitle>
          <CardDescription>
            We couldn't load your current training week. You can start over
            with a fresh plan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
            <AlertDialogTrigger asChild>
              <Button className="w-full">Start over</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Start over?</AlertDialogTitle>
                <AlertDialogDescription>
                  This clears your current plan. Your account stays intact.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onResetPlan}>
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    );
  }

  // State 2: mid-transition gap. The next week (completedCount + 1) failed
  // to generate; clicking re-runs generateNextWeek with default feedback.
  return (
    <Card className="max-w-md mx-auto" role="status" aria-live="polite">
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
          aria-busy={isLoading}
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
