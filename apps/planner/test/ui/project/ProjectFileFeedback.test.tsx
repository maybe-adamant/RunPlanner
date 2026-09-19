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

const session = { recoveryError: null, autosaveError: null, profileFileError: null };

it('keeps document state separate from failures and retains every error in selectable details', () => {
  render(
    <ProjectFileFeedback
      status="Clean"
      session={{ ...session, autosaveError: 'Recovery storage is full.' }}
      result={{
        operation: 'loadProfile',
        status: 'failure',
        message: 'Schema 1 is not supported.',
      }}
    />,
  );
  expect(screen.getByRole('status', { name: 'Document status: Saved' })).toBeTruthy();
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  expect(screen.getByRole('alert').textContent).toBe('Couldn’t load file 2 issues · Details');
  expect(screen.queryByRole('textbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Couldn’t load file 2 issues · Details' }));
  const details = screen.getByRole('dialog', { name: 'File operation details' });
  expect(
    within(details).getByRole('textbox', { name: 'Couldn’t load file details' }),
  ).toHaveProperty('value', 'Schema 1 is not supported.');
  expect(within(details).getByRole('textbox', { name: 'Autosave failed details' })).toHaveProperty(
    'value',
    'Recovery storage is full.',
  );
  for (const textbox of within(details).getAllByRole('textbox'))
    expect(textbox).toHaveProperty('readOnly', true);
  fireEvent.click(within(details).getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('alert')).toBeTruthy();
});

it('does not turn cancellation into a notification', () => {
  render(
    <ProjectFileFeedback
      status="Dirty"
      session={session}
      result={{ operation: 'loadProfile', status: 'cancelled', message: 'Load cancelled.' }}
    />,
  );
  expect(screen.getByRole('status').textContent).toBe('Unsaved changes');
  expect(screen.queryByText('Load cancelled.')).toBeNull();
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
      fireEvent.click(screen.getByRole('button', { name: 'Underworld' }));
    });
  };
  await create();
  expect(screen.getByText('Project created')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(4000));
  await create();
  await act(() => vi.advanceTimersByTimeAsync(4000));
  expect(screen.getByText('Project created')).toBeTruthy();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(screen.queryByText('Project created')).toBeNull();
  createNew.mockResolvedValue({
    operation: 'new',
    status: 'failure',
    message: 'Could not create.',
  });
  await create();
  await act(() => vi.advanceTimersByTimeAsync(10000));
  expect(screen.getByRole('alert').textContent).toContain('Couldn’t create project');
});
