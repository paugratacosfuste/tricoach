import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("renders the anomalous escape-hatch when no completed weeks and no current week", () => {
    const onResetPlan = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 1,
      totalWeeks: 12,
      completedWeeks: [],
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={onResetPlan}
        onViewHistory={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /start over/i });
    fireEvent.click(btn);
    expect(confirmSpy).toHaveBeenCalled();
    expect(onResetPlan).toHaveBeenCalledTimes(1);
  });

  it("does NOT call onResetPlan when user cancels the confirm dialog", () => {
    const onResetPlan = vi.fn();
    const plan = makePlan({
      currentWeekNumber: 1,
      totalWeeks: 12,
      completedWeeks: [],
    });
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <PlanRecoveryCard
        plan={plan}
        onGenerateNext={vi.fn()}
        onResetPlan={onResetPlan}
        onViewHistory={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
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
