import type { Catalog } from '../../../../catalog-schema';
import {
  createBiomeAddress,
  createEncounterPhaseAddress,
  createNemesisRandomEventAddress,
} from '../../../../authored-project/addresses';
import { routeRoomDeclaration } from '../../../../authored-project/route-profile';
import { directEncounterDefinitionKeyForSlot } from '../../../../authored-project/room-state/encounter-envelope';
import type { HistoryEvent } from '../../../history';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import type { SemanticFinding } from '../../../model';
import { ownerRegion } from '../../../finding-regions';
import { fieldsOptionalRewardCountFindings } from '../../../fields/optional-count';
import { beginRewardRoom } from '../../branch-lifecycle';
import type { RewardBranchState } from '../../branch-primitives';
import { rewardFinding } from '../../findings';
import type { BiomeRewardSnapshot } from '../evaluation-contract';
import { rewardFindingChronologyForRoom } from '../finding-chronology';
import type { LifecycleFinding } from './types';

export interface RoomPreparedTransition {
  readonly branches: readonly RewardBranchState[];
  readonly findings: readonly LifecycleFinding[];
}

/** A Nemesis random event's family is fixed when Nemesis spawns on room entry. */
function nemesisFamilyMissingFindings(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
): readonly SemanticFinding[] {
  if (catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent === undefined)
    return [];
  const declaration = routeRoomDeclaration(
    catalog.rooms.byKey[room.gameName],
    room.origin.routeKey,
  );
  if (declaration === undefined) return [];
  return room.encounterPhases.flatMap((phase) => {
    if (
      room.encounters.encounterKeyByPhase[phase.slotKey] === undefined ||
      directEncounterDefinitionKeyForSlot(
        catalog,
        declaration,
        room.encounters,
        phase.slotKey,
        room.gameName,
      ) !== 'NemesisRandomEvent' ||
      (room.encounters.nemesisRandomEventByPhase?.[phase.slotKey] ?? null) !== null
    )
      return [];
    const owner = createNemesisRandomEventAddress(
      createEncounterPhaseAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        phase.slotKey,
      ),
    );
    return [rewardFinding('nemesisOutcomeMissing', owner, {})];
  });
}

/**
 * Room preparation opens the room's reward lifecycle and checks the Overview
 * facts it fixes: Fields optional reward counts and Nemesis event families.
 */
export function applyRoomPreparedTransition(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomPrepared' }>,
  room: CanonicalAuthoredRoom | undefined,
  branches: readonly RewardBranchState[],
): RoomPreparedTransition {
  const findings: LifecycleFinding[] = [];
  if (room !== undefined) {
    const chronology = rewardFindingChronologyForRoom(
      snapshot,
      room.origin,
      event.sequence,
      'localRoomLifecycle',
    );
    for (const finding of fieldsOptionalRewardCountFindings(catalog, room))
      findings.push(Object.freeze({ finding, region: ownerRegion(room.origin), chronology }));
    for (const finding of nemesisFamilyMissingFindings(catalog, room))
      findings.push(Object.freeze({ finding, region: ownerRegion(finding.origin), chronology }));
  }
  return Object.freeze({
    branches: beginRewardRoom(branches, event.sequence),
    findings: Object.freeze(findings),
  });
}
