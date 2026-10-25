// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import { viewChanged } from '@planner/state/librarySessionSlice';
import { selectEditorShown, useAppSelector } from '@planner/state/store';
import { ApplicationFaultBoundary } from '@planner/ui/shell/ApplicationFaultBoundary';
import { createFakeGameModuleHost } from '@planner-test/fixtures/gameModuleHost';
import { createMemoryProjectLibrary } from '@planner-test/support/memoryProjectLibrary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function BrokenEditor() {
  const editorShown = useAppSelector(selectEditorShown);
  if (editorShown) throw new Error('broken project projection');
  return <p>Library is showing.</p>;
}

async function renderFault(options: { readonly withPlan: boolean; readonly desktop: boolean }) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const game = createFakeGameModuleHost();
  const application = createApplication({
    projectLibrary: createMemoryProjectLibrary().adapter,
    ...(options.desktop ? { gameModuleHost: game.host } : {}),
  });
  if (options.withPlan) await application.projectOperations.createNew('Underworld');
  const reload = vi.fn();
  render(<FaultBoundary application={application} reload={reload} />);
  return { application, game, reload };
}

function FaultBoundary({
  application,
  reload,
}: {
  readonly application: PlannerApplication;
  readonly reload: () => void;
}) {
  return (
    <Provider store={application.store}>
      <ApplicationFaultBoundary
        {...(application.bugReport === undefined ? {} : { bugReport: application.bugReport })}
        editorOpen={() => selectEditorShown(application.store.getState())}
        returnToLibrary={() =>
          application.store.dispatch(viewChanged({ kind: 'home', tab: 'library' }))
        }
        reload={reload}
      >
        <BrokenEditor />
      </ApplicationFaultBoundary>
    </Provider>
  );
}

describe('application fault recovery', () => {
  it('returns from a failing plan to the Library', async () => {
    const { application } = await renderFault({ withPlan: true, desktop: false });

    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    expect(screen.getByText('broken project projection')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Generate bug report' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Back to Library' }));

    await waitFor(() => expect(screen.getByText('Library is showing.')).toBeTruthy());
    expect(application.store.getState().librarySession.view).toEqual({
      kind: 'home',
      tab: 'library',
    });
  });

  it('includes the fault in a bug report', async () => {
    const { game } = await renderFault({ withPlan: true, desktop: true });

    await userEvent.click(screen.getByRole('button', { name: 'Generate bug report' }));
    const dialog = await screen.findByRole('dialog', { name: 'Create bug report' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Create…' }));
    await within(dialog).findByRole('status');

    const [, request] = game.host.createBugReport.mock.calls[0]!;
    expect(request.openPlan).not.toBeNull();
    expect(request.appFacts).toMatchObject({
      fault: {
        message: 'broken project projection',
        stack: expect.stringContaining('broken project projection'),
        componentStack: expect.stringContaining('BrokenEditor'),
      },
    });
  });

  it('turns an unhandled asynchronous failure into the same recovery surface', async () => {
    const { reload } = await renderFault({ withPlan: false, desktop: false });

    act(() => {
      const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(rejection, 'reason', { value: new Error('async project failure') });
      globalThis.window.dispatchEvent(rejection);
    });

    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    expect(screen.getByText('async project failure')).toBeTruthy();
    // Without an open plan the Library is what failed, so reloading is the way out.
    expect(screen.queryByRole('button', { name: 'Back to Library' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reload application' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
