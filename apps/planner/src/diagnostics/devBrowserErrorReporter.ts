import type { RootOptions } from 'react-dom/client';

export const DEV_BROWSER_ERROR_EVENT = 'run-planner:browser-error';

export type DevBrowserErrorKind =
  'reactCaught' | 'reactRecoverable' | 'reactUncaught' | 'unhandledRejection' | 'windowError';

export interface DevBrowserErrorPayload {
  readonly column?: number;
  readonly componentStack?: string;
  readonly kind: DevBrowserErrorKind;
  readonly line?: number;
  readonly message: string;
  readonly name?: string;
  readonly pageUrl: string;
  readonly source?: string;
  readonly stack?: string;
  readonly timestamp: string;
  readonly userAgent: string;
}

interface DevHotChannel {
  send(event: typeof DEV_BROWSER_ERROR_EVENT, payload: DevBrowserErrorPayload): void;
}

interface DevBrowserErrorReporterOptions {
  readonly browserWindow?: Window;
  readonly hot?: DevHotChannel | null;
  readonly logReactError?: (error: unknown, errorInfo?: DevReactErrorInfo) => void;
}

interface DevReactErrorInfo {
  readonly componentStack?: string | null | undefined;
}

export interface DevBrowserErrorReporter {
  readonly dispose: () => void;
  readonly rootOptions: RootOptions;
}

function normalizedError(error: unknown): {
  readonly message: string;
  readonly name?: string;
  readonly stack?: string;
} {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      ...(error.stack === undefined ? {} : { stack: error.stack }),
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

export function installDevBrowserErrorReporter(
  options: DevBrowserErrorReporterOptions = {},
): DevBrowserErrorReporter | undefined {
  const hot = options.hot === null ? undefined : (options.hot ?? import.meta.hot);
  if (hot === undefined) {
    return undefined;
  }

  const browserWindow = options.browserWindow ?? globalThis.window;
  const logReactError =
    options.logReactError ??
    ((error: unknown, errorInfo?: DevReactErrorInfo) => {
      globalThis.console.error(error, errorInfo);
    });

  const report = (
    kind: DevBrowserErrorKind,
    error: unknown,
    details: Partial<
      Pick<DevBrowserErrorPayload, 'column' | 'componentStack' | 'line' | 'source'>
    > = {},
  ): void => {
    const normalized = normalizedError(error);
    hot.send(DEV_BROWSER_ERROR_EVENT, {
      ...normalized,
      ...details,
      kind,
      pageUrl: browserWindow.location.href,
      timestamp: new Date().toISOString(),
      userAgent: browserWindow.navigator.userAgent,
    });
  };

  const onWindowError = (event: ErrorEvent): void => {
    report('windowError', event.error ?? event.message, {
      ...(event.colno === 0 ? {} : { column: event.colno }),
      ...(event.lineno === 0 ? {} : { line: event.lineno }),
      ...(event.filename === '' ? {} : { source: event.filename }),
    });
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    report('unhandledRejection', event.reason);
  };

  browserWindow.addEventListener('error', onWindowError);
  browserWindow.addEventListener('unhandledrejection', onUnhandledRejection);

  const reportReactError = (
    kind: Extract<DevBrowserErrorKind, `react${string}`>,
    error: unknown,
    errorInfo?: DevReactErrorInfo,
  ): void => {
    const componentStack = errorInfo?.componentStack;
    report(kind, error, componentStack == null ? {} : { componentStack });
    logReactError(error, errorInfo);
  };

  return {
    dispose: () => {
      browserWindow.removeEventListener('error', onWindowError);
      browserWindow.removeEventListener('unhandledrejection', onUnhandledRejection);
    },
    rootOptions: {
      onCaughtError: (error, errorInfo) => reportReactError('reactCaught', error, errorInfo),
      onRecoverableError: (error, errorInfo) =>
        reportReactError('reactRecoverable', error, errorInfo),
      onUncaughtError: (error, errorInfo) => reportReactError('reactUncaught', error, errorInfo),
    },
  };
}
