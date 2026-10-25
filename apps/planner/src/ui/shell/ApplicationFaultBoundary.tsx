import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { BugReportFault, BugReportOperations } from '@planner/workspace/bugReport';
import { ActionIcon } from '../controls/ActionIcon';
import { BugReportDialog } from './BugReportDialog';

interface ApplicationFaultBoundaryProps {
  readonly children: ReactNode;
  /** Present only in the desktop application. */
  readonly bugReport?: BugReportOperations;
  /** Whether the editor shows an open plan; the Library itself cannot be returned to. */
  readonly editorOpen: () => boolean;
  readonly returnToLibrary: () => void;
  readonly reload: () => void;
}

interface ApplicationFaultBoundaryState {
  readonly error: Error | null;
  readonly componentStack: string | null;
  readonly reporting: boolean;
}

const NO_FAULT: ApplicationFaultBoundaryState = {
  error: null,
  componentStack: null,
  reporting: false,
};

function normalizedError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === 'string') return new Error(error);
  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

export class ApplicationFaultBoundary extends Component<
  ApplicationFaultBoundaryProps,
  ApplicationFaultBoundaryState
> {
  override state: ApplicationFaultBoundaryState = NO_FAULT;

  static getDerivedStateFromError(error: unknown): Partial<ApplicationFaultBoundaryState> {
    return { error: normalizedError(error), componentStack: null };
  }

  override componentDidMount(): void {
    globalThis.window.addEventListener('error', this.onWindowError);
    globalThis.window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    globalThis.console.error('Run Planner recovered from an application error.', error, errorInfo);
    this.setState({ componentStack: errorInfo.componentStack ?? null });
  }

  override componentWillUnmount(): void {
    globalThis.window.removeEventListener('error', this.onWindowError);
    globalThis.window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  private readonly onWindowError = (event: ErrorEvent): void => {
    this.setState({ error: normalizedError(event.error ?? event.message), componentStack: null });
  };

  private readonly onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.setState({ error: normalizedError(event.reason), componentStack: null });
  };

  private readonly backToLibrary = (): void => {
    this.props.returnToLibrary();
    this.setState(NO_FAULT);
  };

  private fault(error: Error): BugReportFault {
    return {
      message: error.message,
      stack: error.stack ?? null,
      componentStack: this.state.componentStack,
    };
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;
    const { bugReport } = this.props;
    const editorOpen = this.props.editorOpen();

    return (
      <main className="application-fault-shell">
        <section aria-labelledby="application-fault-title" className="application-fault-card">
          <p className="eyebrow">Recovery</p>
          <h1 id="application-fault-title">Run Planner could not display this project</h1>
          <p>Your plan is saved in the library.</p>
          <div className="application-fault-actions">
            {editorOpen ? (
              <button className="primary-action" onClick={this.backToLibrary} type="button">
                <ActionIcon name="chevronLeft" />
                Back to Library
              </button>
            ) : null}
            {bugReport === undefined ? null : (
              <button
                className="secondary-action"
                onClick={() => this.setState({ reporting: true })}
                type="button"
              >
                Generate bug report
              </button>
            )}
            <button className="quiet-action" onClick={this.props.reload} type="button">
              Reload application
            </button>
          </div>
          <details className="application-fault-details">
            <summary>Technical details</summary>
            <pre>{error.message}</pre>
          </details>
        </section>
        {this.state.reporting && bugReport !== undefined ? (
          <BugReportDialog
            fault={this.fault(error)}
            onClose={() => this.setState({ reporting: false })}
            operations={bugReport}
          />
        ) : null}
      </main>
    );
  }
}
