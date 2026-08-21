// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DEV_BROWSER_ERROR_EVENT,
  installDevBrowserErrorReporter,
  type DevBrowserErrorPayload,
} from './devBrowserErrorReporter';

const reporters: Array<{ dispose(): void }> = [];

afterEach(() => {
  for (const reporter of reporters.splice(0)) {
    reporter.dispose();
  }
});

function createReporter() {
  const sent: DevBrowserErrorPayload[] = [];
  const logReactError = vi.fn();
  const reporter = installDevBrowserErrorReporter({
    browserWindow: window,
    hot: {
      send: (event, payload) => {
        expect(event).toBe(DEV_BROWSER_ERROR_EVENT);
        sent.push(payload);
      },
    },
    logReactError,
  });

  expect(reporter).toBeDefined();
  reporters.push(reporter!);
  return { logReactError, reporter: reporter!, sent };
}

describe('development browser error reporting', () => {
  it('does not install outside a Vite development session', () => {
    expect(
      installDevBrowserErrorReporter({
        browserWindow: window,
        hot: null,
      }),
    ).toBeUndefined();
  });

  it('forwards uncaught browser errors and rejected promises', () => {
    const { sent } = createReporter();
    const error = new Error('projection failed');

    window.dispatchEvent(
      new ErrorEvent('error', {
        colno: 8,
        error,
        filename: 'http://localhost:5173/workspace.ts',
        lineno: 21,
        message: error.message,
      }),
    );
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: 'async failure' });
    window.dispatchEvent(rejection);

    expect(sent).toMatchObject([
      {
        column: 8,
        kind: 'windowError',
        line: 21,
        message: 'projection failed',
        name: 'Error',
        source: 'http://localhost:5173/workspace.ts',
      },
      {
        kind: 'unhandledRejection',
        message: 'async failure',
      },
    ]);
  });

  it('forwards React root failures while retaining browser-console reporting', () => {
    const { logReactError, reporter, sent } = createReporter();
    const error = new Error('render failed');
    const errorInfo = { componentStack: '\n    at RoomWorkbench' };

    reporter.rootOptions.onUncaughtError?.(error, errorInfo);

    expect(sent).toMatchObject([
      {
        componentStack: '\n    at RoomWorkbench',
        kind: 'reactUncaught',
        message: 'render failed',
        name: 'Error',
      },
    ]);
    expect(logReactError).toHaveBeenCalledWith(error, errorInfo);
  });
});
