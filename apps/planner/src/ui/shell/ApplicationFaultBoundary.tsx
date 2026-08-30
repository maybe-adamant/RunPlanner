import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { ProjectOperationResult } from '@planner/workspace/projectOperations';
import { ActionIcon } from '../controls/ActionIcon';

interface ApplicationFaultBoundaryProps {
  readonly children: ReactNode;
  readonly discardRecoveryAndReload: () => void;
  readonly exportAutosaveRecovery: () => Promise<ProjectOperationResult>;
  readonly loadProfile: () => Promise<ProjectOperationResult>;
  readonly reload: () => void;
}

interface ApplicationFaultBoundaryState {
  readonly error: Error | null;
  readonly pendingOperation: 'exportRecovery' | 'loadProfile' | null;
  readonly result: ProjectOperationResult | null;
}

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
  override state: ApplicationFaultBoundaryState = {
    error: null,
    pendingOperation: null,
    result: null,
  };

  static getDerivedStateFromError(error: unknown): Partial<ApplicationFaultBoundaryState> {
    return { error: normalizedError(error), pendingOperation: null };
  }

  override componentDidMount(): void {
    globalThis.window.addEventListener('error', this.onWindowError);
    globalThis.window.addEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  override componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    globalThis.console.error('Run Planner recovered from an application error.', error, errorInfo);
  }

  override componentWillUnmount(): void {
    globalThis.window.removeEventListener('error', this.onWindowError);
    globalThis.window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
  }

  private readonly onWindowError = (event: ErrorEvent): void => {
    this.setState({
      error: normalizedError(event.error ?? event.message),
      pendingOperation: null,
    });
  };

  private readonly onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    this.setState({ error: normalizedError(event.reason), pendingOperation: null });
  };

  private readonly loadAnotherProfile = async (): Promise<void> => {
    this.setState({ pendingOperation: 'loadProfile', result: null });
    let result: ProjectOperationResult;
    try {
      result = await this.props.loadProfile();
    } catch (error) {
      result = {
        operation: 'loadProfile',
        status: 'failure',
        message: `Load Profile failed: ${normalizedError(error).message}`,
      };
    }
    if (result.status === 'success') {
      this.setState({ error: null, pendingOperation: null, result: null });
      return;
    }
    this.setState({ pendingOperation: null, result });
  };

  private readonly exportAutosave = async (): Promise<void> => {
    this.setState({ pendingOperation: 'exportRecovery', result: null });
    let result: ProjectOperationResult;
    try {
      result = await this.props.exportAutosaveRecovery();
    } catch (error) {
      result = {
        operation: 'exportRecovery',
        status: 'failure',
        message: `Export Autosave failed: ${normalizedError(error).message}`,
      };
    }
    this.setState({ pendingOperation: null, result });
  };

  override render(): ReactNode {
    if (this.state.error === null) return this.props.children;

    return (
      <main className="application-fault-shell">
        <section aria-labelledby="application-fault-title" className="application-fault-card">
          <p className="eyebrow">Recovery</p>
          <h1 id="application-fault-title">Run Planner could not display this project</h1>
          <p>
            The project file was not changed. You can export the autosave for debugging, load
            another project, or reload the application and return to startup recovery.
          </p>
          {this.state.result === null ? null : (
            <p
              className="project-operation-result"
              data-status={this.state.result.status}
              role={this.state.result.status === 'failure' ? 'alert' : 'status'}
            >
              {this.state.result.message}
            </p>
          )}
          <div className="application-fault-actions">
            <button
              className="secondary-action"
              disabled={this.state.pendingOperation !== null}
              onClick={() => void this.loadAnotherProfile()}
              type="button"
            >
              <ActionIcon name="load" />
              {this.state.pendingOperation === 'loadProfile' ? 'Loading…' : 'Load another project'}
            </button>
            <button
              className="secondary-action"
              disabled={this.state.pendingOperation !== null}
              onClick={() => void this.exportAutosave()}
              type="button"
            >
              <ActionIcon name="save" />
              {this.state.pendingOperation === 'exportRecovery' ? 'Exporting…' : 'Export Autosave'}
            </button>
            <button className="quiet-action" onClick={this.props.reload} type="button">
              Reload application
            </button>
            <button
              className="danger-action"
              onClick={this.props.discardRecoveryAndReload}
              type="button"
            >
              Start without recovered project
            </button>
          </div>
          <details className="application-fault-details">
            <summary>Technical details</summary>
            <pre>{this.state.error.message}</pre>
          </details>
        </section>
      </main>
    );
  }
}
