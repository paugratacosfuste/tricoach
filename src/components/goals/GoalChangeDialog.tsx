import { useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Sparkles, RefreshCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

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
 * change (race type / date / priority).
 *
 * UX patch (Wave 6.5.7 + 6.5.8): card-based option layout (each choice is
 * a full-width clickable card with icon + title + subtitle), small "Keep
 * current plan" link in the header, inline loading on the active card,
 * inline error if generation fails. The previous dense-paragraph + 3-button
 * layout was hard to scan and made the dialog feel cramped.
 *
 * Two real choices:
 *   - Rebuild full plan      → recalculate plan length + regenerate this week
 *   - Just adjust this week  → keep plan length, regenerate this week
 *
 * The dialog awaits the chosen async action and stays open with an inline
 * error if it throws, so a silent failure (rate limit, network blip) is
 * never invisible to the user.
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
      setBusy(null);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(null);
    }
  };

  const handleCancel = () => {
    if (busy !== null) return;
    setError(null);
    onOpenChange(false);
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && busy !== null) return;
        if (!next) setError(null);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Goal saved
            </span>
            <button
              type="button"
              onClick={handleCancel}
              disabled={busy !== null}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50 disabled:hover:no-underline"
            >
              Keep current plan
            </button>
          </div>
          <AlertDialogTitle className="text-xl">
            How should we update your training plan?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your race details just changed. Pick how to adapt the plan.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 mt-2">
          <OptionCard
            icon={<Sparkles className="w-5 h-5 text-primary" />}
            title="Rebuild full plan"
            recommendedBadge
            description="Recalculate how many weeks of training you have until race day, then regenerate this week with the new race context. Best when you've changed race type or moved race day by more than a couple of weeks."
            busy={busy === "rebuild"}
            busyLabel="Generating your new plan… (10–15 seconds)"
            onClick={handleAction("rebuild", onRebuildFullPlan)}
            disabled={busy !== null}
            ariaLabel="Rebuild full plan"
          />
          <OptionCard
            icon={<RefreshCw className="w-5 h-5 text-muted-foreground" />}
            title="Just adjust this week"
            description="Keep the existing plan length and just regenerate this week's content with the new race context."
            busy={busy === "adjust"}
            busyLabel="Regenerating this week…"
            onClick={handleAction("adjust", onAdjustThisWeek)}
            disabled={busy !== null}
            ariaLabel="Just adjust this week"
          />
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mt-2"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface OptionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  recommendedBadge?: boolean;
  busy: boolean;
  busyLabel: string;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}

function OptionCard({
  icon,
  title,
  description,
  recommendedBadge,
  busy,
  busyLabel,
  onClick,
  disabled,
  ariaLabel,
}: OptionCardProps) {
  return (
    <button
      type="button"
      role="button"
      aria-label={ariaLabel}
      aria-busy={busy}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full text-left rounded-lg border bg-card transition-colors",
        "px-4 py-3 hover:border-primary hover:bg-primary/5",
        "disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-card",
        busy && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-base">{title}</span>
            {recommendedBadge && (
              <span className="text-[10px] uppercase tracking-wide font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                Recommended
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 leading-snug">{description}</p>
          {busy && (
            <div className="mt-2 flex items-center gap-2 text-sm text-primary font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{busyLabel}</span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
