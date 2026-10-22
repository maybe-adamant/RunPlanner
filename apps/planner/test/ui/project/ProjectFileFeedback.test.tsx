// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { ProjectFileFeedback } from '@planner/ui/project/ProjectFileFeedback';

afterEach(() => {
  cleanup();
});

const session = { writeError: null };

it('shows only failures, keeping every error in details', () => {
  render(
    <ProjectFileFeedback
      session={{ ...session, writeError: 'Could not save the plan: disk full.' }}
      result={{
        operation: 'importPlan',
        status: 'failure',
        message: 'Schema 1 is not supported.',
      }}
    />,
  );
  expect(screen.queryByText('Saved as you edit')).toBeNull();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('alert').textContent).toBe('Couldn’t open file 2 issues · Details');
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Couldn’t open file 2 issues · Details' }));
  const details = screen.getByRole('dialog', { name: 'Plan details' });
  expect(
    within(details).getByRole('textbox', { name: 'Couldn’t open file details' }),
  ).toHaveProperty('value', 'Schema 1 is not supported.');
  expect(within(details).getByRole('textbox', { name: 'Not saved details' })).toHaveProperty(
    'value',
    'Could not save the plan: disk full.',
  );
  for (const textbox of within(details).getAllByRole('textbox'))
    expect(textbox).toHaveProperty('readOnly', true);
  fireEvent.click(within(details).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('shows nothing while the plan saves, and no notification for success or cancellation', () => {
  const { container, rerender } = render(<ProjectFileFeedback session={session} result={null} />);
  expect(container.textContent).toBe('');
  rerender(
    <ProjectFileFeedback
      session={session}
      result={{ operation: 'importPlan', status: 'cancelled', message: 'Open file cancelled.' }}
    />,
  );
  expect(container.textContent).toBe('');
  rerender(
    <ProjectFileFeedback
      session={session}
      result={{ operation: 'revert', status: 'success', message: 'Reverted.' }}
    />,
  );
  expect(container.textContent).toBe('');
  expect(screen.queryByRole('status')).toBeNull();
});
