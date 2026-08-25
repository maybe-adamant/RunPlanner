import type { WorkspaceOccurrenceActionAssemblyInput } from './occurrence-action-row-projection';
import { roomActionsForOccurrence } from './occurrence-action-row-projection';
import { assembleOccurrenceRunState } from './occurrence-action-run-state';

export type {
  WorkspaceOccurrenceActionAssembly,
  WorkspaceOccurrenceActionAssemblyInput,
  WorkspaceOccurrenceActionsInput,
} from './occurrence-action-row-projection';
export { rewardChildMarkers } from './occurrence-action-markers';
export { roomTabForPhase } from './occurrence-action-run-state';

/** Compose complete row, timeline, and run-state products for one occurrence. */
export function assembleOccurrenceActions(input: WorkspaceOccurrenceActionAssemblyInput) {
  const roomActions = roomActionsForOccurrence(
    input,
    input.roomLocal,
    input.encounterPhases,
    input.controls,
  );
  return Object.freeze({
    roomActions,
    ...assembleOccurrenceRunState(input, input.roomLocal, input.roomLabel, roomActions),
  });
}
