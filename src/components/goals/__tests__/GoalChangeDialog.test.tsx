import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { GoalChangeDialog } from "../GoalChangeDialog";

describe("GoalChangeDialog", () => {
  it("renders both choice buttons + cancel when open (Wave 6.5)", () => {
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={vi.fn()}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: /rebuild full plan/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /just adjust this week/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /keep current plan/i })).toBeInTheDocument();
  });

  it("calls onRebuildFullPlan when the primary action is clicked", () => {
    const onRebuildFullPlan = vi.fn();
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /rebuild full plan/i }));
    expect(onRebuildFullPlan).toHaveBeenCalledTimes(1);
  });

  it("calls onAdjustThisWeek when the secondary action is clicked", () => {
    const onAdjustThisWeek = vi.fn();
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={vi.fn()}
        onAdjustThisWeek={onAdjustThisWeek}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /just adjust this week/i }));
    expect(onAdjustThisWeek).toHaveBeenCalledTimes(1);
  });

  it("does NOT call either action handler when Cancel is clicked", () => {
    const onRebuildFullPlan = vi.fn();
    const onAdjustThisWeek = vi.fn();
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={onAdjustThisWeek}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /keep current plan/i }));
    expect(onRebuildFullPlan).not.toHaveBeenCalled();
    expect(onAdjustThisWeek).not.toHaveBeenCalled();
  });

  it("renders nothing when open=false", () => {
    render(
      <GoalChangeDialog
        open={false}
        onOpenChange={vi.fn()}
        onRebuildFullPlan={vi.fn()}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });
});
