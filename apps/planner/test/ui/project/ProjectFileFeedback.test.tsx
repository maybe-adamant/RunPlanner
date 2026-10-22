// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, expect, it, vi } from 'vitest';
import { createApplication } from '@planner/composition/createApplication';
import { ProjectFileFeedback } from '@planner/ui/project/ProjectFileFeedback';
import { ProjectFileControls } from '@planner/ui/project/ProjectFileControls';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const session = { writeError: null, openError: null };

it('shows a failed write in place of the saved status and keeps every error in details', () => {
  render(
    <ProjectFileFeedback
      savesAsYouEdit
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

it('does not turn cancellation into a notification', () => {
  render(
    <ProjectFileFeedback
      savesAsYouEdit
      session={session}
      result={{ operation: 'importPlan', status: 'cancelled', message: 'Open file cancelled.' }}
    />,
  );
  expect(screen.getByRole('status').textContent).toBe('Saved as you edit');
  expect(screen.queryByText('Open file cancelled.')).toBeNull();
});

it('expires confirmations, renews repeated operations, and never times out failures', async () => {
  vi.useFakeTimers();
  const application = createApplication();
  const createNew = vi.fn(application.projectOperations.createNew);
  createNew.mockResolvedValue({ operation: 'new', status: 'success', message: 'Created.' });
  render(
    <Provider store={application.store}>
      <ProjectFileControls
        catalog={application.catalog}
        operations={{ ...application.projectOperations, createNew }}
        routes={application.editorNavigation.routes.values}
        hasProject={false}
        entryOpen
        onEntryOpenChange={() => undefined}
      />
    </Provider>,
  );
  const create = async () => {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Underworld project' }));
    });
  };
  await create();
  expect(screen.getByText('Plan created')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(4000));
  await create();
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByText('Plan created')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.queryByText('Plan created')).toBeNull();
  createNew.mockResolvedValue({
    operation: 'new',
    status: 'failure',
    message: 'Could not create.',
  });
  await create();
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(screen.getByRole('alert').textContent).toContain('Couldn’t create plan');
});
