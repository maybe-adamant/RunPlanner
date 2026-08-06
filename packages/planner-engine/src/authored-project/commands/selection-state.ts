import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type { BiomeTopology, ExitDecision } from '../model';
import type { RoomOccurrenceRole } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { failCommand, type LocatedBiome } from './contract';
import type { ProjectCommand } from './types';

function entryRole(
  room: RoomDeclaration,
  targetIndex: number,
  command: ProjectCommand,
): RoomOccurrenceRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  if (room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') return 'prebossShop';
  if (targetIndex === 0) return 'prebossShop';
  if (room.prebossBatchPolicy.remainingOffers.kind !== 'counted') {
    failCommand(command, `${room.gameName} has no remaining Preboss offer for this exit`);
  }
  return 'prebossFreeReward';
}

/**
 * Changing a decision's selected continuation changes whether its normal
 * Shop/Preboss targets have entry-owned state. Keep that leaf reconciliation
 * beside command authority so every selection mutation (including a closed
 * additional continuation) shares exactly the same state transition.
 */
export function reconcileNormalTargetEntryStates(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  decision: ExitDecision,
  selectedNormalExitKey: string | undefined,
  command: ProjectCommand,
): BiomeTopology {
  const occurrences = topology.occurrences.map((occurrence) => {
    const targetIndex = decision.normal.targets.findIndex(
      (target) => target.occurrenceId === occurrence.occurrenceId,
    );
    if (targetIndex < 0) return occurrence;
    const room = catalog.rooms.byKey[occurrence.gameName];
    if (room === undefined) failCommand(command, `unknown room ${occurrence.gameName}`);

    // A normal G target may be an Anomaly replacement. Its own state does not
    // have a selection-activated leaf, and no route-detour room is admitted here
    // merely because this reconciliation needs to inspect it.
    if (room.roomSetKey !== located.layout.biomeKey) return occurrence;
    if (room.kind !== 'Preboss' && room.kind !== 'Shop') return occurrence;

    const role = entryRole(room, targetIndex, command);
    if (role !== 'prebossShop' && room.kind !== 'Shop') return occurrence;
    const entryActive = decision.normal.targets[targetIndex]?.exitKey === selectedNormalExitKey;
    const hasInventory = occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined;
    if (hasInventory === entryActive) return occurrence;
    const defaultState = createDefaultRoomState(catalog, room, { role, entryActive });
    if (defaultState.kind !== 'shop') {
      failCommand(command, `${room.gameName} has no entry-activated Shop state`);
    }
    return Object.freeze({ ...occurrence, state: defaultState });
  });
  return Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) });
}
