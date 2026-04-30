import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { TrainingPlan, WeekPlan, Workout } from "@/types/training";

// --- Mocks ---------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockUseTraining = vi.fn();
vi.mock("@/contexts/TrainingContext", () => ({
  useTraining: () => mockUseTraining(),
}));

// Replace heavy children with passthrough divs so the test only inspects
// the Dashboard's own rendering decisions.
vi.mock("@/components/dashboard/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));
vi.mock("@/components/dashboard/WorkoutDetailSheet", () => ({
  WorkoutDetailSheet: () => null,
}));
vi.mock("@/components/WeekReview", () => ({
  WeekReview: () => null,
}));
vi.mock("@/components/RegeneratePlanDialog", () => ({
  RegeneratePlanDialog: () => null,
}));

// --- Helpers -------------------------------------------------------------

function basePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
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

function baseWeek(overrides: Partial<WeekPlan> = {}): WeekPlan {
  return {
    weekNumber: 5,
    startDate: new Date("2026-04-27"),
    endDate: new Date("2026-05-03"),
    theme: "Build phase",
    focus: "Aerobic capacity",
    phase: "Build",
    totalPlannedHours: 8,
    isRecoveryWeek: false,
    workouts: [] as Workout[],
    ...overrides,
  } as WeekPlan;
}

function trainingState(overrides: Record<string, unknown> = {}) {
  return {
    plan: null,
    currentWeek: null,
    isLoading: false,
    error: null,
    clearError: vi.fn(),
    updateWorkoutStatus: vi.fn(),
    rescheduleWorkout: vi.fn(),
    regenerateCurrentWeek: vi.fn(),
    getTodaysWorkout: () => undefined,
    getUpcomingWorkouts: () => [],
    generateNextWeek: vi.fn(),
    resetPlan: vi.fn(),
    ...overrides,
  };
}

// Imported AFTER the mocks above.
import Dashboard from "../Dashboard";

describe("Dashboard routing decisions", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseTraining.mockReset();
  });

  it("renders the legacy Welcome card when no plan exists at all", () => {
    mockUseTraining.mockReturnValue(trainingState({ plan: null, currentWeek: null }));
    render(<Dashboard />);
    expect(screen.getByText(/welcome to tricoach ai/i)).toBeInTheDocument();
    // The recovery card's specific copy must NOT appear in this case.
    expect(
      screen.queryByText(/your next training week is ready/i),
    ).not.toBeInTheDocument();
  });

  it("renders PlanRecoveryCard when plan exists but currentWeek is null (gap state)", () => {
    const plan = basePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [
        { weekNumber: 1 },
        { weekNumber: 2 },
        { weekNumber: 3 },
        { weekNumber: 4 },
      ] as unknown as TrainingPlan["completedWeeks"],
    });
    mockUseTraining.mockReturnValue(
      trainingState({ plan, currentWeek: null }),
    );
    render(<Dashboard />);
    expect(
      screen.getByText(/your next training week is ready/i),
    ).toBeInTheDocument();
    // The legacy Welcome copy must NOT show up — we used to bounce here.
    expect(
      screen.queryByText(/welcome to tricoach ai/i),
    ).not.toBeInTheDocument();
  });

  it("renders PlanRecoveryCard race-finished state when currentWeekNumber > totalWeeks", () => {
    const plan = basePlan({
      currentWeekNumber: 13,
      totalWeeks: 12,
      completedWeeks: Array.from({ length: 12 }, (_, i) => ({ weekNumber: i + 1 })) as unknown as TrainingPlan["completedWeeks"],
    });
    mockUseTraining.mockReturnValue(trainingState({ plan, currentWeek: null }));
    render(<Dashboard />);
    expect(screen.getByText(/plan complete/i)).toBeInTheDocument();
  });

  it("clicking 'Generate this week' invokes generateNextWeek with default feedback", async () => {
    const generateNextWeek = vi.fn().mockResolvedValue(undefined);
    const plan = basePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    mockUseTraining.mockReturnValue(
      trainingState({ plan, currentWeek: null, generateNextWeek }),
    );
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /generate this week/i }));
    await waitFor(() => {
      expect(generateNextWeek).toHaveBeenCalledTimes(1);
    });
    const [feedback] = generateNextWeek.mock.calls[0];
    expect(feedback).toMatchObject({
      overallFeeling: expect.any(String),
      physicalIssues: expect.any(Array),
    });
  });

  it("clicking 'View history' on recovery card navigates to /history", () => {
    const plan = basePlan({
      currentWeekNumber: 5,
      totalWeeks: 12,
      completedWeeks: [{ weekNumber: 1 }] as unknown as TrainingPlan["completedWeeks"],
    });
    mockUseTraining.mockReturnValue(trainingState({ plan, currentWeek: null }));
    render(<Dashboard />);
    fireEvent.click(screen.getByRole("button", { name: /view.*history/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/history");
  });

  it("renders the normal week dashboard when currentWeek is populated", () => {
    const plan = basePlan({ currentWeekNumber: 5 });
    const week = baseWeek({ weekNumber: 5, theme: "Aerobic build" });
    mockUseTraining.mockReturnValue(
      trainingState({ plan, currentWeek: week }),
    );
    render(<Dashboard />);
    expect(screen.getByText(/week 5 of 12/i)).toBeInTheDocument();
    // Neither welcome nor recovery card should render in the happy path.
    expect(
      screen.queryByText(/welcome to tricoach ai/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/your next training week is ready/i),
    ).not.toBeInTheDocument();
  });
});
