import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import {
  AlertDialog,
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
  /**
   * Recommended path: rebuild totalWeeks + regenerate current week. Awaited
   * by the dialog so the user sees a loading indicator and any error.
   * Should reject if generation fails — the dialog stays open so the user
   * can retry or pick a different action.
   */
  readonly onRebuildFullPlan: () => Promise<void> | void;
  /** Lighter path: keep totalWeeks, regenerate just this week. Same await semantics. */
  readonly onAdjustThisWeek: () => Promise<void> | void;
}

type BusyState = null | "rebuild" | "adjust";

/**
 * Wave 6.5 / D7: shown after the user saves a training-affecting goal
 * change (race type / date / priority). Replaces the old single-button
 * dialog that only called `regenerateCurrentWeek` and left `totalWeeks`
 * stale.
 *
 * Three actions:
 *   - Rebuild full plan      → recompute structure + regenerate current week
 *   - Just adjust this week  → preserve structure, regenerate current week
 *   - Keep current plan      → cancel, no-op
 *
 * The dialog awaits the chosen async action so the user sees a spinner
 * while Anthropic is generating (~10-15s) instead of seeing the dialog
 * close immediately and wondering whether anything actually happened.
 * On error, the dialog stays open with an inline error message so the
 * user can retry without losing context.
 */
export function GoalChangeDialog({
  open,
  onOpenChange,
  onRebuildFullPlan,
  onAdjustThisWeek,
}: GoalChangeDialogProps) {
  const [busy, setBusy] = useState<BusyState>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAction = (action: "rebuild" | "adjust", fn: () => Promise<void> | void) => async () => {
    setBusy(action);
    setError(null);
    try {
      await fn();
      // Reset internal state then close on success.
      setBusy(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  const handleCancel = () => {
    if (busy !== null) return; // ignore while a generation is in flight
    setError(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Block close-on-Escape / overlay-click while busy so the user
        // can't lose visibility into an in-flight Anthropic call.
        if (!next && busy !== null) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400 mb-1">
            <CheckCircle2 className="w-4 h-4" />
            Goal saved
          </div>
          <AlertDialogTitle>Update training plan?</AlertDialogTitle>
          <AlertDialogDescription>
            Your race details changed. <strong>Rebuild full plan</strong> recalculates how many
            weeks of training you have until race day and starts a fresh current week with the new
            race context — recommended when you've changed race type or moved the race by more than
            a couple of weeks. <strong>Just adjust this week</strong> keeps the existing plan
            length but regenerates this week's content with the new context.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row sm:justify-end gap-2">
          <Button variant="ghost" onClick={handleCancel} disabled={busy !== null}>
            Keep current plan
          </Button>
          <Button
            variant="outline"
            onClick={handleAction("adjust", onAdjustThisWeek)}
            disabled={busy !== null}
            aria-busy={busy === "adjust"}
          >
            {busy === "adjust" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adjusting…
              </>
            ) : (
              "Just adjust this week"
            )}
          </Button>
          <Button
            onClick={handleAction("rebuild", onRebuildFullPlan)}
            disabled={busy !== null}
            aria-busy={busy === "rebuild"}
          >
            {busy === "rebuild" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Rebuilding…
              </>
            ) : (
              "Rebuild full plan"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
