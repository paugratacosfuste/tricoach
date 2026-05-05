import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { PlanRecoveryCard } from "../PlanRecoveryCard";
import type { TrainingPlan } from "@/types/training";

function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: "plan-1",
    createdAt: new Date(),
    raceName: "Test Race",
    raceDate: new Date("2026-12-31"),
    raceType: "olympic-triathlon",
    totalWeeks: 12,
    currentWeekNumber: 5,
    currentWeek: null,
    completedWeeks: [],
    ...overrides,
  } as TrainingPlan;
}

describe("PlanRecoveryCard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the plan-complete state when currentWeekNumber > totalWeeks", () => {
    const plan = makePlan({
      currentWeekNumber: 13,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }, { weekNumber: 2 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    expect(screen.getByText(/plan complete/i)).toBeInTheDocument();
    // No regenerate button in this state — race week is behind us.
    expect(
      screen.queryByRole("button", { name: /generate this week/i }),
    ).not.toBeInTheDocument();
  });

  // ── D2: Start-a-new-plan CTA in race-complete state ─────────────────────
  it("renders 'Start a new plan' CTA in race-complete state when onStartNewPlan is provided (D2)", () => {
    const onStartNewPlan = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 13,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
        onStartNewPlan={onStartNewPlan}
      />,
    );
    const btn = screen.getByRole("button", { name: /start a new plan/i });
    fireEvent.click(btn);
    expect(onStartNewPlan).toHaveBeenCalledTimes(1);
  });

  it("does NOT render 'Start a new plan' CTA when onStartNewPlan prop is omitted (D2 backward compat)", () => {
    const plan = makePlan({
      currentWeekNumber: 13,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /start a new plan/i })).not.toBeInTheDocument();
  });

  it("renders the gap-recovery state with a 'generate this week' button", () => {
    const onGenerateNext = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [
        { weekNumber: 1 },
        { weekNumber: 2 },
        { weekNumber: 3 },
        { weekNumber: 4 },
      ] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={onGenerateNext}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /generate this week/i });
    fireEvent.click(btn);
    expect(onGenerateNext).toHaveBeenCalledTimes(1);
  });

  it("disables the generate button when isLoading is true", () => {
    const onGenerateNext = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        isLoading
        onGenerateNext={onGenerateNext}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /generate this week/i });
    expect(btn).toBeDisabled();
  });

  // ── D3: AlertDialog replaces window.confirm ────────────────────────────
  it("opens an AlertDialog (not window.confirm) when 'Start over' is clicked (D3)", () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const plan = makePlan({
      currentWeekNumber: 1,
      totalWeeks: 12,
      completedWeeks: [],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    // Radix AlertDialog renders alertdialog role when open.
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("calls onResetPlan only after the AlertDialog Continue action is clicked (D3)", () => {
    const onResetPlan = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 1,
      totalWeeks: 12,
      completedWeeks: [],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={onResetPlan}
        onViewHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    // Reset is not called just by opening the dialog.
    expect(onResetPlan).not.toHaveBeenCalled();
    // Click the destructive Continue action inside the dialog.
    const dialog = screen.getByRole("alertdialog");
    const continueBtn = within(dialog).getByRole("button", { name: /continue|start over/i });
    fireEvent.click(continueBtn);
    expect(onResetPlan).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onResetPlan when user clicks Cancel in the AlertDialog (D3)", () => {
    const onResetPlan = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 1,
      totalWeeks: 12,
      completedWeeks: [],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={onResetPlan}
        onViewHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    const dialog = screen.getByRole("alertdialog");
    const cancelBtn = within(dialog).getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(onResetPlan).not.toHaveBeenCalled();
  });

  it("displays the next week number based on completed weeks (not the stale currentWeekNumber)", () => {
    // Repro: in the recovery state, plan.currentWeekNumber may be stale
    // (e.g. equal to the just-completed week's number) because the
    // previous transition didn't get to bump it. The "Generate week N"
    // copy must reflect what's actually next, derived from completedWeeks.
    const plan = makePlan({
      currentWeekNumber: 1, // stale value from a partially-failed transition
      totalWeeks: 13,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    // Should advertise week 2 (completedWeeks.length + 1), not week 1.
    expect(screen.getByText(/generate week 2/i)).toBeInTheDocument();
    expect(screen.queryByText(/generate week 1\b/i)).not.toBeInTheDocument();
  });

  // ── D4: aria-live + aria-busy ───────────────────────────────────────────
  it("exposes the card as a polite live region and marks the loading button aria-busy (D4)", () => {
    const plan = makePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        isLoading
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={vi.fn()}
      />,
    );
    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    const generateBtn = screen.getByRole("button", { name: /generate this week/i });
    expect(generateBtn).toHaveAttribute("aria-busy", "true");
  });

  it("calls onViewHistory when the history button is clicked (gap state)", () => {
    const onViewHistory = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={vi.fn()}
        onViewHistory={onViewHistory}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /view.*history/i }));
    expect(onViewHistory).toHaveBeenCalledTimes(1);
  });
});
