import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TrainingPlan, WeekPlan } from "@/types/training";

// --- Mocks ---------------------------------------------------------------

const mockUseOnboarding = vi.fn();
const mockUseTraining = vi.fn();

vi.mock("@/contexts/OnboardingContext", () => ({
  useOnboarding: () => mockUseOnboarding(),
}));
vi.mock("@/contexts/TrainingContext", () => ({
  useTraining: () => mockUseTraining(),
}));

// Children — replace with markers so we can assert which one rendered.
vi.mock("@/components/onboarding/OnboardingWizard", () => ({
  OnboardingWizard: () => <div data-testid="wizard">wizard</div>,
}));
vi.mock("@/pages/Dashboard", () => ({
  default: () => <div data-testid="dashboard">dashboard</div>,
}));

// Imported AFTER mocks.
import Index from "../Index";

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
    startDate: new Date(),
    endDate: new Date(),
    theme: "",
    focus: "",
    phase: "Build",
    totalPlannedHours: 8,
    isRecoveryWeek: false,
    workouts: [],
    ...overrides,
  } as WeekPlan;
}

describe("Index page routing", () => {
  beforeEach(() => {
    mockUseOnboarding.mockReset();
    mockUseTraining.mockReset();
  });

  it("renders the wizard when isStarted && !isComplete (mid-onboarding)", () => {
    mockUseOnboarding.mockReturnValue({
      isStarted: true,
      isComplete: false,
      startOnboarding: vi.fn(),
    });
    mockUseTraining.mockReturnValue({ plan: null });
    render(<Index />);
    expect(screen.getByTestId("wizard")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
  });

  it("renders the dashboard when plan has a populated currentWeek (happy path)", () => {
    mockUseOnboarding.mockReturnValue({
      isStarted: true,
      isComplete: true,
      startOnboarding: vi.fn(),
    });
    mockUseTraining.mockReturnValue({
      plan: basePlan({ currentWeek: baseWeek() }),
    });
    render(<Index />);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });

  it("routes to Dashboard (not Welcome) when plan exists but currentWeek is null and onboarding is complete — the stuck-on-Welcome bug", () => {
    mockUseOnboarding.mockReturnValue({
      isStarted: true,
      isComplete: true,
      startOnboarding: vi.fn(),
    });
    mockUseTraining.mockReturnValue({
      plan: basePlan({
        currentWeekNumber: 5,
        completedWeeks: [{ weekNumber: 1 }],
        currentWeek: null,
      }),
    });
    render(<Index />);
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
    expect(screen.queryByText(/welcome to tricoach ai/i)).not.toBeInTheDocument();
  });

  it("renders the welcome screen with Get Started for fresh users (no plan, not started)", () => {
    mockUseOnboarding.mockReturnValue({
      isStarted: false,
      isComplete: false,
      startOnboarding: vi.fn(),
    });
    mockUseTraining.mockReturnValue({ plan: null });
    render(<Index />);
    expect(screen.getByText(/welcome to tricoach ai/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /get started/i })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(screen.queryByTestId("wizard")).not.toBeInTheDocument();
  });
});
