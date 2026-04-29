import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { OnboardingWizard } from '../OnboardingWizard';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

// Mock AuthContext
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn().mockReturnValue({ user: { id: 'test-user' } }),
  AuthProvider: ({ children }: any) => <>{children}</>,
}));

// Mock the step components to make tests focused
vi.mock('../steps/ProfileStep', () => ({
  ProfileStep: () => <div data-testid="profile-step">Profile Step</div>,
}));
vi.mock('../steps/FitnessStep', () => ({
  FitnessStep: () => <div data-testid="fitness-step">Fitness Step</div>,
}));
vi.mock('../steps/GoalStep', () => ({
  GoalStep: () => <div data-testid="goal-step">Goal Step</div>,
}));
vi.mock('../steps/AvailabilityStep', () => ({
  AvailabilityStep: () => <div data-testid="availability-step">Availability Step</div>,
}));
vi.mock('../steps/IntegrationsStep', () => ({
  IntegrationsStep: () => <div data-testid="integrations-step">Integrations Step</div>,
}));

// Import after mocks so the mock is applied
import { OnboardingProvider } from '@/contexts/OnboardingContext';
import { useAuth } from '@/contexts/AuthContext';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

function renderWizard() {
  return render(
    <OnboardingProvider>
      <OnboardingWizard />
    </OnboardingProvider>
  );
}

describe('OnboardingWizard', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    (useAuth as any).mockReturnValue({ user: { id: 'test-user' } });
  });

  it('renders the first step (ProfileStep) by default', () => {
    renderWizard();
    expect(screen.getByTestId('profile-step')).toBeInTheDocument();
  });

  it('shows the app title', () => {
    renderWizard();
    expect(screen.getAllByText('TriCoach AI').length).toBeGreaterThan(0);
  });

  it('displays step progress indicator', () => {
    renderWizard();
    // Should show "Step 1 of 5" text
    expect(screen.getAllByText(/Step 1 of 5/).length).toBeGreaterThan(0);
  });

  it('renders all step titles in the sidebar', () => {
    renderWizard();
    expect(screen.getByText('Profile')).toBeInTheDocument();
    expect(screen.getByText('Fitness')).toBeInTheDocument();
    expect(screen.getByText('Goal')).toBeInTheDocument();
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
  });

  it('shows step descriptions', () => {
    renderWizard();
    expect(screen.getByText('Tell us about yourself')).toBeInTheDocument();
    expect(screen.getByText('Your current fitness level')).toBeInTheDocument();
    expect(screen.getByText('Set your race goal')).toBeInTheDocument();
    expect(screen.getByText('Weekly availability')).toBeInTheDocument();
    expect(screen.getByText('Link your accounts')).toBeInTheDocument();
  });

  it('does not render other step components when on step 1', () => {
    renderWizard();
    expect(screen.queryByTestId('fitness-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('goal-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('availability-step')).not.toBeInTheDocument();
    expect(screen.queryByTestId('integrations-step')).not.toBeInTheDocument();
  });
});
