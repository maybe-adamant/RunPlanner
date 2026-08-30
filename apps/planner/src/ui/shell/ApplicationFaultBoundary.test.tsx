// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApplicationFaultBoundary } from './ApplicationFaultBoundary';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('application fault recovery', () => {
  it('keeps native profile loading available after a project render fails', async () => {
    let faulted = true;
    const loadProfile = vi.fn(async () => {
      faulted = false;
      return {
        operation: 'loadProfile' as const,
        status: 'success' as const,
        message: 'Loaded the profile.',
      };
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function ProjectSurface() {
      if (faulted) throw new Error('broken project projection');
      return <p>Replacement project is ready.</p>;
    }

    render(
      <ApplicationFaultBoundary
        discardRecoveryAndReload={() => undefined}
        loadProfile={loadProfile}
        reload={() => undefined}
      >
        <ProjectSurface />
      </ApplicationFaultBoundary>,
    );

    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    expect(screen.getByText('broken project projection')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Load another project' }));

    await waitFor(() => expect(screen.getByText('Replacement project is ready.')).toBeTruthy());
    expect(loadProfile).toHaveBeenCalledOnce();
    consoleError.mockRestore();
  });

  it('retains the recovery surface when the replacement file also fails preparation', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const loadProfile = vi.fn(async () => ({
      operation: 'loadProfile' as const,
      status: 'failure' as const,
      message: 'Load Profile failed: invalid route',
    }));
    function BrokenProject(): null {
      throw new Error('broken project projection');
    }

    render(
      <ApplicationFaultBoundary
        discardRecoveryAndReload={() => undefined}
        loadProfile={loadProfile}
        reload={() => undefined}
      >
        <BrokenProject />
      </ApplicationFaultBoundary>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Load another project' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Load Profile failed: invalid route',
    );
    expect(
      screen.getByRole('heading', { name: 'Run Planner could not display this project' }),
    ).toBeTruthy();
    consoleError.mockRestore();
  });

  it('turns an unhandled asynchronous failure into the same recovery surface', async () => {
    const discardRecoveryAndReload = vi.fn();
    render(
      <ApplicationFaultBoundary
        discardRecoveryAndReload={discardRecoveryAndReload}
        loadProfile={() =>
          Promise.resolve({
            operation: 'loadProfile',
            status: 'cancelled',
            message: 'Load Profile cancelled.',
          })
        }
        reload={() => undefined}
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
    await userEvent.click(screen.getByRole('button', { name: 'Start without recovered project' }));
    expect(discardRecoveryAndReload).toHaveBeenCalledOnce();
  });
});
