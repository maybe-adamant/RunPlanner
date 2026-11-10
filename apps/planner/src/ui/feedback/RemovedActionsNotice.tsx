import type { Catalog } from '@run-planner/engine/catalog-schema';
import { useMemo } from 'react';

import { removedActionsAnnouncement } from '@planner/projections/removedActionsAnnouncement';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import { removedActionsLead, removedActionsUndo } from '@planner/projections/walkStopCopy';
import { findingSelected } from '@planner/state/editorSessionSlice';
import {
  authoredProjectUndoRequested,
  removedActionsAnnouncementDismissed,
} from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';

/**
 * The last edit's removals in rooms it did not address, each room linked as the stop notice
 * links its place; it stays until dismissed, undone or replaced by the next edit.
 */
export function RemovedActionsNotice({
  catalog,
  workspace,
}: {
  readonly catalog: Catalog;
  readonly workspace: Pick<StructuredWorkspaceProjection, 'focusByOwner' | 'route'>;
}) {
  const dispatch = useAppDispatch();
  const removed = useAppSelector((state) => state.projectWorkspace.removedStaleActions);
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  const rooms = useMemo(
    () =>
      removed === undefined ? undefined : removedActionsAnnouncement(catalog, removed, workspace),
    [catalog, removed, workspace],
  );
  return (
    <div aria-live="polite" className="removed-actions-region">
      {rooms === undefined || rooms.length === 0 ? null : (
        <div className="removed-actions-notice" data-removed-actions-notice="">
          <ul className="removed-actions-rooms">
            {rooms.map((room) => (
              <li key={room.key}>
                {removedActionsLead(room.count, room.doors)}{' '}
                <button
                  className="stop-notice-link"
                  disabled={drafting}
                  onClick={() => dispatch(findingSelected(room.selection))}
                  type="button"
                >
                  {room.place}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="secondary-action action-compact"
            disabled={drafting}
            onClick={() => dispatch(authoredProjectUndoRequested())}
            type="button"
          >
            {removedActionsUndo}
          </button>
          <button
            className="quiet-action action-compact"
            onClick={() => dispatch(removedActionsAnnouncementDismissed())}
            type="button"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
