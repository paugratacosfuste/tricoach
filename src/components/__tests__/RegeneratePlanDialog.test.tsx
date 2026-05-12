import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RegeneratePlanDialog } from '../RegeneratePlanDialog';

// Phase 1.E.3 — UI guard against the same prompt-injection / oversized-
// input vectors `sanitizePromptInput` strips on the server. The cap stops
// the user typing more than 500 chars (model-cost + sanitiser-truncation
// both happen anyway, but a visible counter is the UX honest signal).
// Sanitisation itself is server-side; the form just bounds what the
// athlete can submit.

const MAX_LEN = 500;

function setup() {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <RegeneratePlanDialog
      isOpen={true}
      onClose={onClose}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit, onClose };
}

describe('RegeneratePlanDialog — Phase 1.E.3 input cap + counter', () => {
  it('caps the comment textarea at 500 characters via the maxLength attribute', () => {
    setup();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(MAX_LEN);
  });

  it('renders a live X / 500 counter that reflects the current value', () => {
    setup();
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello world' } });
    expect(screen.getByText(/11\s*\/\s*500/)).toBeTruthy();
  });

  it('counter shows 0 / 500 when the field is empty', () => {
    setup();
    expect(screen.getByText(/0\s*\/\s*500/)).toBeTruthy();
  });
});
