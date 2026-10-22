import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { ProjectOperationResult } from '@planner/workspace/projectOperations';
import { ActionIcon } from '../controls/ActionIcon';

interface ApplicationFaultBoundaryProps {
  readonly children: ReactNode;
  /** Imports a file into the library and opens it in place of the failing plan. */
  readonly openFile: () => Promise<ProjectOperationResult>;
  readonly reload: () => void;
  /** Reloads without reopening the failing plan; it stays in the library. */
  readonly reloadWithoutPlan: () => void;
}

interface ApplicationFaultBoundaryState {
  readonly error: Error | null;
  readonly pendingOperation: 'importPlan' | null;
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

  private readonly openAnotherFile = async (): Promise<void> => {
    this.setState({ pendingOperation: 'importPlan', result: null });
    let result: ProjectOperationResult;
    try {
      result = await this.props.openFile();
    } catch (error) {
      result = {
        operation: 'importPlan',
        status: 'failure',
        message: `Open file failed: ${normalizedError(error).message}`,
      };
    }
    if (result.status === 'success') {
      this.setState({ error: null, pendingOperation: null, result: null });
      return;
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
            The plan is still in your library as it was last saved. You can open another file,
            reload the application, or start without reopening this plan.
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
              onClick={() => void this.openAnotherFile()}
              type="button"
            >
              <ActionIcon name="load" />
              {this.state.pendingOperation === 'importPlan' ? 'Opening…' : 'Open another file'}
            </button>
            <button className="quiet-action" onClick={this.props.reload} type="button">
              Reload application
            </button>
            <button className="danger-action" onClick={this.props.reloadWithoutPlan} type="button">
              Start without this plan
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
