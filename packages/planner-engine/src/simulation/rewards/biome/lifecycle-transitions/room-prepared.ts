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
import type { NemesisRandomEventCandidateSupport } from '../../model';
import { nemesisRandomEventFamilySupport } from '../encounter-acquisition/nemesis-random-event';

export interface RoomPreparedTransition {
  readonly branch: RewardBranchState | undefined;
  readonly findings: readonly LifecycleFinding[];
  /** Each Nemesis event's family support, read from the state she spawns in. */
  readonly nemesisCandidates: readonly NemesisRandomEventCandidateSupport[];
}

/**
 * A Nemesis random event's family is fixed when Nemesis spawns on room entry:
 * its support reads the held traits there, and a family left unset, or one
 * that state cannot queue, is the event's own finding.
 */
function nemesisEventsOnEntry(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  branch: RewardBranchState | undefined,
): {
  readonly findings: readonly SemanticFinding[];
  readonly candidates: readonly NemesisRandomEventCandidateSupport[];
} {
  const findings: SemanticFinding[] = [];
  const candidates: NemesisRandomEventCandidateSupport[] = [];
  const declaration = routeRoomDeclaration(
    catalog.rooms.byKey[room.gameName],
    room.origin.routeKey,
  );
  if (
    catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent === undefined ||
    declaration === undefined
  )
    return { findings, candidates };
  for (const phase of room.encounterPhases) {
    if (
      room.encounters.encounterKeyByPhase[phase.slotKey] === undefined ||
      directEncounterDefinitionKeyForSlot(
        catalog,
        declaration,
        room.encounters,
        phase.slotKey,
        room.gameName,
      ) !== 'NemesisRandomEvent'
    )
      continue;
    const owner = createNemesisRandomEventAddress(
      createEncounterPhaseAddress(
        createBiomeAddress(room.origin.routeKey, room.origin.biomeKey),
        { kind: 'occurrence', occurrenceId: room.occurrenceId },
        phase.slotKey,
      ),
    );
    const support =
      branch === undefined
        ? undefined
        : nemesisRandomEventFamilySupport(catalog, owner, branch.state.traitHistory.equippedTraits);
    if (support !== undefined) candidates.push(support);
    const family = room.encounters.nemesisRandomEventByPhase?.[phase.slotKey]?.kind;
    if (family === undefined) {
      findings.push(rewardFinding('nemesisOutcomeMissing', owner, {}));
      continue;
    }
    const refusal = support?.unavailableFamilies[family];
    if (refusal !== undefined)
      findings.push(
        rewardFinding('nemesisEventUnavailable', owner, {
          kind: family,
          reason: refusal.kind,
          ...(refusal.kind === 'heldTrait' ? { traitKey: refusal.traitKey } : {}),
        }),
      );
  }
  return { findings, candidates };
}

/**
 * Room preparation opens the room's reward lifecycle and checks the Overview
 * facts it fixes: Fields optional reward counts and Nemesis event families.
 * It reads the branch before the room begins, the state Nemesis spawns in.
 */
export function applyRoomPreparedTransition(
  catalog: Catalog,
  snapshot: BiomeRewardSnapshot,
  event: Extract<HistoryEvent, { readonly kind: 'roomPrepared' }>,
  room: CanonicalAuthoredRoom | undefined,
  branch: RewardBranchState | undefined,
): RoomPreparedTransition {
  const findings: LifecycleFinding[] = [];
  const nemesis = room === undefined ? undefined : nemesisEventsOnEntry(catalog, room, branch);
  if (room !== undefined) {
    const chronology = rewardFindingChronologyForRoom(
      snapshot,
      room.origin,
      event.sequence,
      'localRoomLifecycle',
    );
    for (const finding of fieldsOptionalRewardCountFindings(catalog, room))
      findings.push(Object.freeze({ finding, region: ownerRegion(room.origin), chronology }));
    for (const finding of nemesis?.findings ?? [])
      findings.push(Object.freeze({ finding, region: ownerRegion(finding.origin), chronology }));
  }
  return Object.freeze({
    branch: beginRewardRoom(branch, event.sequence),
    findings: Object.freeze(findings),
    nemesisCandidates: Object.freeze([...(nemesis?.candidates ?? [])]),
  });
}
