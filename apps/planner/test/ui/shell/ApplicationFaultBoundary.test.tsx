// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationFaultBoundary } from '@planner/ui/shell/ApplicationFaultBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('application fault recovery', () => {
  it('keeps opening another file available after a project render fails', async () => {
    let faulted = true;
    const openFile = vi.fn(async () => {
      faulted = false;
      return {
        operation: 'importPlan' as const,
        status: 'success' as const,
        message: 'Opened.',
      };
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function ProjectSurface() {
      if (faulted) throw new Error('broken project projection');
      return <p>Replacement project is ready.</p>;
    }

    render(
      <ApplicationFaultBoundary openFile={openFile} reload={() => undefined}>
        <ProjectSurface />
      </ApplicationFaultBoundary>,
    );

    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    expect(screen.getByText('broken project projection')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Open another file' }));

    await waitFor(() => expect(screen.getByText('Replacement project is ready.')).toBeTruthy());
    expect(openFile).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('retains the recovery surface when the replacement file also fails preparation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const openFile = vi.fn(async () => ({
      operation: 'importPlan' as const,
      status: 'failure' as const,
      message: 'Open file failed: invalid route',
    }));
    function BrokenProject(): null {
      throw new Error('broken project projection');
    }

    render(
      <ApplicationFaultBoundary openFile={openFile} reload={() => undefined}>
        <BrokenProject />
      </ApplicationFaultBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Open another file' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Open file failed: invalid route',
    );
    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    consoleError.mockRestore();
  });

  it('turns an unhandled asynchronous failure into the same recovery surface', async () => {
    const reload = vi.fn();
    render(
      <ApplicationFaultBoundary
        openFile={() =>
          Promise.resolve({
            operation: 'importPlan',
            status: 'cancelled',
            message: 'Open file cancelled.',
          })
        }
        reload={reload}
      >
        <p>Project is open.</p>
      </ApplicationFaultBoundary>,
    );

    act(() => {
      const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
      Object.defineProperty(rejection, 'reason', { value: new Error('async project failure') });
      globalThis.window.dispatchEvent(rejection);
    });

    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    expect(screen.getByText('async project failure')).toBeTruthy();
    // The app starts on Home with no plan open, so reloading is the way out.
    expect(screen.queryByRole('button', { name: 'Start without this plan' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reload application' }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
