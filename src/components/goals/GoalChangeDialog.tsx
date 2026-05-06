import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export interface GoalChangeDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Recommended path: rebuild totalWeeks + regenerate current week. */
  readonly onRebuildFullPlan: () => void;
  /** Lighter path: keep totalWeeks, regenerate just this week. */
  readonly onAdjustThisWeek: () => void;
}

/**
 * Wave 6.5 / D7: shown after the user saves a training-affecting goal
 * change (race type / date / priority). Replaces the old single-button
 * dialog that only called `regenerateCurrentWeek` and left `totalWeeks`
 * stale. Three actions:
 *
 *   - Rebuild full plan  → recompute structure + regenerate current week
 *   - Just adjust this week → preserve structure, regenerate current week
 *   - Keep current plan  → cancel, no-op
 *
 * Phase 7 (UX strip-down once cron lands) may merge "rebuild now" with
 * "apply at next Sunday rollover" — that decision is deferred.
 */
export function GoalChangeDialog({
  open,
  onOpenChange,
  onRebuildFullPlan,
  onAdjustThisWeek,
}: GoalChangeDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Update Training Plan?</AlertDialogTitle>
          <AlertDialogDescription>
            Your race goal has changed. Rebuilding the full plan recalculates
            how many weeks of training you have until race day and starts a
            fresh current week with the new race context. Adjusting just this
            week keeps the existing structure but updates this week's content.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
          <AlertDialogCancel>Keep current plan</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => onAdjustThisWeek()}
          >
            Just adjust this week
          </Button>
          <AlertDialogAction onClick={() => onRebuildFullPlan()}>
            Rebuild full plan
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
