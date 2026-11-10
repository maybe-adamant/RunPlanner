import {
  StructuredWorkspaceProjectionContractError,
  type WorkspaceShipPhasePresentation,
} from '../contract';
import type {
  HubRunStateCheckpointAddress,
  RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type {
  WorkspaceOccurrenceActionsInput,
  WorkspaceOccurrenceActionAssembly,
} from './occurrence-action-row-projection';
import type { WorkspaceRoomActions } from '../contracts/timeline';
import type { WorkspaceRoomLocal } from '../contracts/locals';
import { presentRunState } from '../presentation/run-state';
import type { WorkspaceRoomTab } from '../contracts/navigation';
import type { WorkspaceRunStateLauncher } from '../contracts/run-state';

export function roomTabForPhase(
  roomLocal: Extract<WorkspaceRoomLocal, { readonly kind: 'ship' }>,
  phaseKey: string,
): WorkspaceShipPhasePresentation['tab'];
export function roomTabForPhase(roomLocal: WorkspaceRoomLocal, phaseKey: string): WorkspaceRoomTab;
export function roomTabForPhase(roomLocal: WorkspaceRoomLocal, phaseKey: string): WorkspaceRoomTab {
  if (roomLocal.kind !== 'ship') return 'actions';
  switch (roomLocal.phases.findIndex((phase) => phase.key === phaseKey)) {
    case 0:
      return 'shipIntroActions';
    case 1:
      return 'shipCombat1Actions';
    case 2:
      return 'shipCombat2Actions';
    default:
      throw new StructuredWorkspaceProjectionContractError(
        `Ship timeline references unknown phase ${phaseKey}`,
      );
  }
}

type RunStateLookup<Owner> = (
  owner: Owner,
) => ReturnType<WorkspaceOccurrenceActionsInput['runState']>;

export function runStateLauncher<
  Owner extends RoomRunStateCheckpointAddress | HubRunStateCheckpointAddress,
>(
  input: { readonly catalog: Catalog; readonly runState: RunStateLookup<Owner> },
  owner: Owner,
  title: string,
  momentLead: string,
): WorkspaceRunStateLauncher | undefined {
  const runState = input.runState(owner);
  if (runState === undefined) return undefined;
  return runState.availability === 'available'
    ? Object.freeze({
        availability: 'available' as const,
        owner,
        state: presentRunState(input.catalog, runState.snapshot, momentLead),
        title,
      })
    : Object.freeze({ availability: 'unavailable' as const, owner, title });
}

/** A room's (or the Hub's) Run State on entry, before its first action. */
export function roomEnteredRunStateLauncher<
  Owner extends RoomRunStateCheckpointAddress | HubRunStateCheckpointAddress,
>(
  input: { readonly catalog: Catalog; readonly runState: RunStateLookup<Owner> },
  owner: Owner,
  roomLabel: string,
): WorkspaceRunStateLauncher | undefined {
  return runStateLauncher(input, owner, `the first action in ${roomLabel}`, `Before ${roomLabel}`);
}

export function assembleOccurrenceRunState(
  input: WorkspaceOccurrenceActionsInput,
  roomLocal: WorkspaceRoomLocal,
  roomActions: WorkspaceRoomActions | undefined,
): Pick<WorkspaceOccurrenceActionAssembly, 'runStateLaunchers' | 'runStateByTab'> {
  const byTab: Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>> = {};
  for (const entry of roomActions?.timeline.entries ?? []) {
    if (entry.kind !== 'boundary' || entry.runState === undefined) continue;
    if (roomLocal.kind === 'ship' && entry.boundary.kind === 'encounterStart') {
      const tab = roomTabForPhase(roomLocal, entry.boundary.phaseKey);
      byTab[tab] = entry.runState;
      if (byTab.overview === undefined) {
        byTab.overview = entry.runState;
      }
    } else if (roomLocal.kind !== 'ship' && entry.boundary.kind === 'roomEntered') {
      for (const tab of ['overview', 'actions'] as const) {
        byTab[tab] = entry.runState;
      }
    }
  }
  return Object.freeze({
    runStateLaunchers: Object.freeze([
      ...(roomActions?.timeline.entries ?? []).flatMap((entry) =>
        entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
      ),
    ]),
    runStateByTab: Object.freeze(byTab),
  });
}
