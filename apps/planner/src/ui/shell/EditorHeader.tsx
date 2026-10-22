import { useState, type CSSProperties } from 'react';

import type { StatusPresentation } from '@planner/projections/evaluationProjection';
import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { GameSendProject } from '@planner/projections/gamePanel';
import { viewChanged } from '@planner/state/librarySessionSlice';
import {
  selectLibrarySession,
  selectRevertAvailable,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import type {
  ProjectOperationResult,
  ProjectOperations,
} from '@planner/workspace/projectOperations';
import { ActionIcon } from '../controls/ActionIcon';
import { StatusBadge } from '../feedback/EvaluationFeedback';
import { ProjectFileFeedback } from '../project/ProjectFileFeedback';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { PLAN_NAME_FIELD_ID, ProjectNameField } from '../project/ProjectNameField';
import { GameSendControls } from './GameSendControls';

/** The open plan's header: back to Home, its name and save state, readiness, history and send. */
export function EditorHeader({
  banner,
  gameStatus,
  name,
  onShowFindings,
  operations,
  readiness,
  startPointBlock,
}: {
  /** The route's victory scene behind the editor, when it has one. */
  readonly banner: { readonly routeKey: string; readonly url: string } | null;
  readonly gameStatus: GameStatusController | undefined;
  readonly name: string;
  readonly onShowFindings: (() => void) | undefined;
  readonly operations: ProjectOperations;
  readonly readiness: StatusPresentation;
  readonly startPointBlock?: GameSendProject['startPointBlock'];
}) {
  const dispatch = useAppDispatch();
  const librarySession = useAppSelector(selectLibrarySession);
  const revertAvailable = useAppSelector(selectRevertAvailable);
  // Only a failed discard is reported; a write failure comes from the library session.
  const [failure, setFailure] = useState<ProjectOperationResult | null>(null);

  return (
    <header
      className="app-header editor-header"
      {...(banner === null
        ? {}
        : {
            'data-route-banner': banner.routeKey,
            style: { '--route-banner': `url("${banner.url}")` } as CSSProperties,
          })}
    >
      <button
        className="quiet-action editor-home-button"
        onClick={() => dispatch(viewChanged({ kind: 'home', tab: 'library' }))}
        type="button"
      >
        <ActionIcon name="chevronLeft" />
        Home
      </button>
      <div className="editor-title">
        <ProjectNameField key={name} name={name} />
        <button
          className="text-action"
          onClick={() => {
            const field = document.getElementById(PLAN_NAME_FIELD_ID);
            if (field instanceof HTMLInputElement) {
              field.focus();
              field.select();
            }
          }}
          type="button"
        >
          Rename
        </button>
        {/* Shown only after an edit since opening; its space stays so nothing shifts. */}
        <button
          aria-hidden={!revertAvailable || undefined}
          className="text-action editor-discard"
          data-hidden={!revertAvailable || undefined}
          disabled={!revertAvailable}
          onClick={() => {
            const outcome = operations.revertToOpened();
            setFailure(outcome.status === 'failure' ? outcome : null);
          }}
          tabIndex={revertAvailable ? undefined : -1}
          type="button"
        >
          Discard changes
        </button>
        <span className="editor-save-slot">
          <ProjectFileFeedback result={failure} session={librarySession} />
        </span>
      </div>
      <span className="editor-header-spacer" />
      <StatusBadge status={readiness} />
      <ProjectHistoryControls hasProject />
      <GameSendControls
        gameStatus={gameStatus}
        onShowFindings={onShowFindings}
        operations={operations}
        {...(startPointBlock === undefined ? {} : { startPointBlock })}
      />
    </header>
  );
}
