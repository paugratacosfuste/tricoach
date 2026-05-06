import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { GoalChangeDialog } from "../GoalChangeDialog";

describe("GoalChangeDialog", () => {
  it("renders both option cards, the keep-current-plan dismiss, and the goal-saved confirmation", () => {
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={vi.fn()}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText(/goal saved/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^rebuild full plan$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^just adjust this week$/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /^keep current plan$/i })).toBeInTheDocument();
    // The Recommended badge marks the primary path.
    expect(within(dialog).getByText(/recommended/i)).toBeInTheDocument();
  });

  it("calls onRebuildFullPlan and closes on success", async () => {
    const onOpenChange = vi.fn();
    const onRebuildFullPlan = vi.fn().mockResolvedValue(undefined);
    render(
      <GoalChangeDialog
        open
        onOpenChange={onOpenChange}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^rebuild full plan$/i }));
    await waitFor(() => expect(onRebuildFullPlan).toHaveBeenCalledOnce());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("calls onAdjustThisWeek and closes on success", async () => {
    const onOpenChange = vi.fn();
    const onAdjustThisWeek = vi.fn().mockResolvedValue(undefined);
    render(
      <GoalChangeDialog
        open
        onOpenChange={onOpenChange}
        onRebuildFullPlan={vi.fn()}
        onAdjustThisWeek={onAdjustThisWeek}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^just adjust this week$/i }));
    await waitFor(() => expect(onAdjustThisWeek).toHaveBeenCalledOnce());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("does NOT call action handlers when Cancel is clicked", () => {
    const onRebuildFullPlan = vi.fn();
    const onAdjustThisWeek = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <GoalChangeDialog
        open
        onOpenChange={onOpenChange}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={onAdjustThisWeek}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^keep current plan$/i }));
    expect(onRebuildFullPlan).not.toHaveBeenCalled();
    expect(onAdjustThisWeek).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
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

  it("marks the rebuild card aria-busy and shows inline status while in flight (Wave 6.5 fix)", async () => {
    let resolveFn!: () => void;
    const onRebuildFullPlan = vi.fn(
      () => new Promise<void>((resolve) => { resolveFn = resolve; }),
    );
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^rebuild full plan$/i }));
    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /^rebuild full plan$/i });
      expect(btn).toHaveAttribute("aria-busy", "true");
      // Busy label is rendered inside the card so the user sees what's happening.
      expect(within(btn).getByText(/generating your new plan/i)).toBeInTheDocument();
    });
    resolveFn();
  });

  it("disables other actions while one is in flight (Wave 6.5 fix)", async () => {
    let resolveFn!: () => void;
    const onRebuildFullPlan = vi.fn(
      () => new Promise<void>((resolve) => { resolveFn = resolve; }),
    );
    render(
      <GoalChangeDialog
        open
        onOpenChange={vi.fn()}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^rebuild full plan$/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^just adjust this week$/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /^keep current plan$/i })).toBeDisabled();
    });
    resolveFn();
  });

  it("displays an error message and stays open when the action throws (Wave 6.5 fix)", async () => {
    const onOpenChange = vi.fn();
    const onRebuildFullPlan = vi.fn().mockRejectedValue(new Error("Anthropic exploded"));
    render(
      <GoalChangeDialog
        open
        onOpenChange={onOpenChange}
        onRebuildFullPlan={onRebuildFullPlan}
        onAdjustThisWeek={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^rebuild full plan$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/anthropic exploded/i);
    });
    // Dialog must NOT have been asked to close on failure — user keeps context.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
