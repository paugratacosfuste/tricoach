import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekReview } from '../WeekReview';
import type { WeekPlan } from '@/types/training';

// Phase 1.E.3 — UI guard for the two free-text fields whose values flow
// into the Claude prompt: `notes` (→ feedback.notes) and `constraints`
// (→ nextWeekConstraints). Server `sanitizePromptInput` truncates at
// 500 regardless; the maxLength + counter is the honest UX signal.

const MAX_LEN = 500;

function makeWeek(): WeekPlan {
  return {
    weekNumber: 3,
    startDate: new Date('2026-04-28'),
    endDate: new Date('2026-05-04'),
    theme: 'Base Building',
    focus: 'Aerobic',
    phase: 'Base',
    totalPlannedHours: 6,
    isRecoveryWeek: false,
    workouts: [],
  };
}

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <WeekReview
      isOpen={true}
      onClose={onClose}
      onSubmit={onSubmit}
      currentWeek={makeWeek()}
    />,
  );
  return { onSubmit, onClose };
}

describe('WeekReview — Phase 1.E.3 input cap + counter', () => {
  it('caps the notes textarea at 500 characters', () => {
    setup();
    const notes = screen.getByLabelText(/Additional notes/i) as HTMLTextAreaElement;
    expect(notes.maxLength).toBe(MAX_LEN);
  });

  it('caps the constraints textarea at 500 characters', () => {
    setup();
    const constraints = screen.getByLabelText(/Anything affecting next week/i) as HTMLTextAreaElement;
    expect(constraints.maxLength).toBe(MAX_LEN);
  });

  it('shows a counter under the notes field that updates on input', () => {
    setup();
    const notes = screen.getByLabelText(/Additional notes/i) as HTMLTextAreaElement;
    fireEvent.change(notes, { target: { value: 'felt strong this week' } });
    expect(screen.getAllByText(/21\s*\/\s*500/).length).toBeGreaterThan(0);
  });

  it('shows a counter under the constraints field that updates on input', () => {
    setup();
    const constraints = screen.getByLabelText(/Anything affecting next week/i) as HTMLTextAreaElement;
    fireEvent.change(constraints, { target: { value: 'travel mon-wed' } });
    expect(screen.getAllByText(/14\s*\/\s*500/).length).toBeGreaterThan(0);
  });
});
