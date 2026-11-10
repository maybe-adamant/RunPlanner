import type { Catalog } from '@run-planner/engine/catalog-schema';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { RemovedStaleRoomActions } from '@run-planner/engine/simulation';
import type { FindingSelection } from '@planner/state/editorSessionSlice';
import { findingLocation, ownerSelection } from './evaluationProjection';
import type { StructuredWorkspaceProjection } from './structured-workspace';
import { stopNoticeLink } from './walkStopCopy';

/** One room an edit removed rows in, named and reached as the stop notice names its place. */
export interface RemovedActionsRoom {
  readonly key: string;
  readonly count: number;
  /** The room's link text, such as "Location 40". */
  readonly place: string;
  readonly selection: FindingSelection;
}

/** The rooms of an edit's announced removals, in the settlement's order. */
export function removedActionsAnnouncement(
  catalog: Catalog,
  removed: readonly RemovedStaleRoomActions[],
  workspace: Pick<StructuredWorkspaceProjection, 'focusByOwner' | 'route'>,
): readonly RemovedActionsRoom[] {
  return Object.freeze(
    removed.map(({ occurrence, actions }) => {
      const key = semanticAddressKey(occurrence);
      const place = findingLocation(
        catalog,
        occurrence,
        workspace.focusByOwner.get(key),
        workspace.route,
      );
      return Object.freeze({
        key,
        count: actions.length,
        place: stopNoticeLink({ kind: 'past', place }),
        selection: ownerSelection(occurrence, `removedActions:${key}`, workspace.focusByOwner),
      });
    }),
  );
}
