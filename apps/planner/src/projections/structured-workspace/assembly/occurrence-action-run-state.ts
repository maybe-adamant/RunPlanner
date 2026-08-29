import {
  createOccurrenceAddress,
  createRoomRunStateCheckpointAddress,
  type RoomRunStateCheckpointAddress,
} from '@run-planner/engine/authored-project';
import type {
  WorkspaceOccurrenceActionsInput,
  WorkspaceOccurrenceActionAssembly,
} from './occurrence-action-row-projection';
import type {
  WorkspaceRoomActions,
  WorkspaceRoomLocal,
  WorkspaceRoomTab,
  WorkspaceRunStateLauncher,
} from '../contract';
import { presentRunState } from '../presentation/run-state';

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
      return 'actions';
  }
}

export function runStateLauncher(
  input: WorkspaceOccurrenceActionsInput,
  owner: RoomRunStateCheckpointAddress,
  title: string,
): WorkspaceRunStateLauncher | undefined {
  const runState = input.runState(owner);
  if (runState === undefined) return undefined;
  return runState.availability === 'available'
    ? Object.freeze({
        availability: 'available' as const,
        owner,
        state: presentRunState(input.catalog, runState.snapshot),
        title,
      })
    : Object.freeze({ availability: 'unavailable' as const, owner, title });
}

export function assembleOccurrenceRunState(
  input: WorkspaceOccurrenceActionsInput,
  roomLocal: WorkspaceRoomLocal,
  roomLabel: string,
  roomActions: WorkspaceRoomActions | undefined,
): Pick<
  WorkspaceOccurrenceActionAssembly,
  'beforeExitRunState' | 'runStateLaunchers' | 'runStateByTab'
> {
  const owner = createOccurrenceAddress(input.biome, input.occurrence.occurrenceId);
  const beforeExitRunState = runStateLauncher(
    input,
    createRoomRunStateCheckpointAddress(owner, { kind: 'beforeRoomExit' }),
    `exiting ${roomLabel}`,
  );
  const byTab: Partial<Record<WorkspaceRoomTab, WorkspaceRunStateLauncher>> = {};
  for (const entry of roomActions?.timeline.entries ?? []) {
    if (entry.kind !== 'boundary' || entry.runState === undefined) continue;
    if (roomLocal.kind === 'ship' && entry.boundary.kind === 'encounterStart') {
      const tab = roomTabForPhase(roomLocal, entry.boundary.phaseKey);
      byTab[tab] = entry.runState;
      if (byTab.overview === undefined) {
        byTab.overview = entry.runState;
        byTab.features = entry.runState;
        byTab.encounters = entry.runState;
      }
    } else if (roomLocal.kind !== 'ship' && entry.boundary.kind === 'roomEntered') {
      for (const tab of [
        'overview',
        'features',
        'sideRooms',
        'minorRewards',
        'encounters',
        'actions',
      ] as const) {
        byTab[tab] = entry.runState;
      }
    }
  }
  if (beforeExitRunState !== undefined) byTab.doors = beforeExitRunState;
  return Object.freeze({
    beforeExitRunState,
    runStateLaunchers: Object.freeze([
      ...(roomActions?.timeline.entries ?? []).flatMap((entry) =>
        entry.kind === 'boundary' && entry.runState !== undefined ? [entry.runState] : [],
      ),
      ...(beforeExitRunState === undefined ? [] : [beforeExitRunState]),
    ]),
    runStateByTab: Object.freeze(byTab),
  });
}
