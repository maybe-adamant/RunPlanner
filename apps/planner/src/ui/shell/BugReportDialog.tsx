import { useEffect, useRef, useState } from 'react';

import { selectPresentProject, useAppSelector } from '@planner/state/store';
import type {
  BugReportContents,
  BugReportFault,
  BugReportOperations,
} from '@planner/workspace/bugReport';
import { ModalDialog } from '@planner/ui/controls/ModalDialog';

type Stage =
  | { readonly kind: 'choosing' }
  | { readonly kind: 'saving' }
  | { readonly kind: 'saved'; readonly fileName: string; readonly issuePageUrl: string };

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type BugReportChoices = Omit<BugReportContents, 'fault'>;

export function BugReportDialog({
  fault,
  onClose,
  operations,
}: {
  /** The error the application stopped on; its report leaves out the game's files. */
  readonly fault?: BugReportFault;
  readonly onClose: () => void;
  readonly operations: BugReportOperations;
}) {
  const hasOpenPlan = useAppSelector((state) => selectPresentProject(state) !== undefined);
  const [contents, setContents] = useState<BugReportChoices>({
    openPlan: hasOpenPlan,
    plansInGame: fault === undefined,
    gameLogs: fault === undefined,
  });
  const [stage, setStage] = useState<Stage>({ kind: 'choosing' });
  const [error, setError] = useState<string | null>(null);
  const saving = stage.kind === 'saving';
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (stage.kind === 'saved') closeButton.current?.focus();
  }, [stage.kind]);

  const create = async () => {
    setStage({ kind: 'saving' });
    setError(null);
    try {
      const outcome = await operations.create({
        ...contents,
        openPlan: contents.openPlan && hasOpenPlan,
        ...(fault === undefined ? {} : { fault }),
      });
      setStage(outcome.kind === 'saved' ? outcome : { kind: 'choosing' });
    } catch (failure) {
      setError(errorText(failure));
      setStage({ kind: 'choosing' });
    }
  };
  const act = (action: () => Promise<void>) => {
    setError(null);
    action().catch((failure: unknown) => setError(errorText(failure)));
  };
  const option = (key: keyof BugReportChoices, label: string, disabled = false) => (
    <label className="bug-report-option">
      <input
        checked={contents[key] && !disabled}
        disabled={disabled || saving}
        onChange={(event) => setContents({ ...contents, [key]: event.target.checked })}
        type="checkbox"
      />
      <span>{label}</span>
    </label>
  );

  return (
    <ModalDialog
      className="game-publication-dialog"
      labelledBy="bug-report-title"
      onCancel={onClose}
      pending={saving}
    >
      <header className="panel-heading">
        <h2 id="bug-report-title">
          {fault === undefined ? 'Create bug report' : 'Report this error'}
        </h2>
      </header>
      {stage.kind === 'saved' ? (
        <p className="game-publication-message" role="status">
          Saved {stage.fileName}.
        </p>
      ) : (
        <>
          <fieldset className="bug-report-options">
            <legend>Include</legend>
            {option('openPlan', 'Open plan', !hasOpenPlan)}
            {fault === undefined ? (
              <>
                {option('plansInGame', 'Plans in game')}
                {option('gameLogs', 'Game logs')}
              </>
            ) : null}
          </fieldset>
          <p className="game-publication-hint">Paths are replaced with %USERPROFILE%.</p>
        </>
      )}
      {error === null ? null : (
        <p className="game-publication-message" role="alert">
          {error}
        </p>
      )}
      <footer className="game-publication-actions">
        {stage.kind === 'saved' ? (
          <>
            <button
              className="secondary-action"
              onClick={() => act(() => operations.reveal())}
              type="button"
            >
              Show in folder
            </button>
            <button
              className="secondary-action"
              onClick={() => act(() => operations.openIssuePage(stage.issuePageUrl))}
              type="button"
            >
              Report on GitHub
            </button>
            <button className="quiet-action" onClick={onClose} ref={closeButton} type="button">
              Close
            </button>
          </>
        ) : (
          <>
            <button className="quiet-action" disabled={saving} onClick={onClose} type="button">
              Cancel
            </button>
            <button
              className="primary-action"
              data-initial-focus
              disabled={saving}
              onClick={() => void create()}
              type="button"
            >
              {saving ? 'Saving…' : 'Create…'}
            </button>
          </>
        )}
      </footer>
    </ModalDialog>
  );
}
