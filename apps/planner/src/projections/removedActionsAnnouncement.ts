import type { Catalog } from '@run-planner/engine/catalog-schema';
import { semanticAddressKey } from '@run-planner/engine/authored-project';
import type { RemovedStaleRoomActions } from '@run-planner/engine/simulation';
import type { FindingSelection } from '@planner/state/editorSessionSlice';
import { findingLocation, ownerSelection } from './evaluationProjection';
import { locationName, type PlaceName } from './placeName';
import type { StructuredWorkspaceProjection } from './structured-workspace';

/** One room an edit removed rows in, named as every reference names it, opened on its Timeline. */
export interface RemovedActionsRoom {
  readonly key: string;
  readonly count: number;
  /** Doors the room lost because it no longer has them. */
  readonly doors: number;
  /** The room's link, such as "Location 40" with its room name on hover. */
  readonly place: PlaceName;
  readonly selection: FindingSelection;
}

/** The rooms of an edit's announced removals, in the settlement's order. */
export function removedActionsAnnouncement(
  catalog: Catalog,
  removed: readonly RemovedStaleRoomActions[],
  workspace: Pick<StructuredWorkspaceProjection, 'focusByOwner' | 'route'>,
): readonly RemovedActionsRoom[] {
  return Object.freeze(
    removed.map(({ occurrence, actions, doors }) => {
      const key = semanticAddressKey(occurrence);
      return Object.freeze({
        key,
        count: actions.length,
        doors: doors?.length ?? 0,
        place: locationName(
          findingLocation(catalog, occurrence, workspace.focusByOwner.get(key), workspace.route),
        ),
        // The removed rows and doors lived on the room's Timeline.
        selection: {
          ...ownerSelection(occurrence, `removedActions:${key}`, workspace.focusByOwner),
          presentation: { kind: 'roomTimeline' as const },
        },
      });
    }),
  );
}
