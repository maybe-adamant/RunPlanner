import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { ExitDecisionSourceAddress } from '../../addresses';
import type {
  BatchRewardStoreState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  HubDecision,
  LocalVisitDecision,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../../model';
import { type RoomOccurrenceRole } from '../../room-state/declaration';
import { createDefaultRoomState } from '../../room-state/defaults';
import { createDefaultRoomEncounterState } from '../../room-state/encounter-envelope';
import { isHostRouteDetourRoom } from '../../topology/query';
import { sameExitDecisionSource } from '../../topology/source-identity';
import { createDefaultRoomActionState } from '../../room-actions/state';
import { failCommand, requireOccurrence, withBiome, type LocatedBiome } from '../contract';
import type { TopologyCommand } from '../types';
import { exitKeysForTopologySource } from '../topology-reconciliation';

export function sourceFromAddress(source: ExitDecisionSourceAddress): ExitDecisionSource {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
}

export function exitKeysForSource(
  catalog: Catalog,
  located: LocatedBiome,
  source: ExitDecisionSourceAddress,
  command: TopologyCommand,
): readonly string[] {
  const topology = located.plan.topology;
  if (topology === null) failCommand(command, 'normal-door source requires topology');
  return exitKeysForTopologySource(catalog, located, topology, source, command);
}

export function sourceRoom(
  catalog: Catalog,
  located: LocatedBiome,
  source: ExitDecisionSourceAddress,
  command: TopologyCommand,
): RoomDeclaration | undefined {
  if (source.kind === 'hubDecision') return undefined;
  const gameName = requireOccurrence(located.plan, source.occurrenceId, command).gameName;
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) failCommand(command, `unknown room ${gameName}`);
  if (room.mode.kind !== 'authored') failCommand(command, `${gameName} is layout-derived`);
  if (room.roomSetKey !== located.layout.biomeKey && !isHostRouteDetourRoom(room)) {
    failCommand(command, `${gameName} belongs to ${room.roomSetKey}`);
  }
  return room;
}

export function replaceDecision(
  topology: BiomeTopology,
  replacement: ExitDecision | HubDecision | LocalVisitDecision,
): BiomeTopology {
  const decisions = topology.decisions.map((decision) =>
    decision.kind === 'exit' && replacement.kind === 'exit'
      ? sameExitDecisionSource(decision.source, replacement.source)
        ? replacement
        : decision
      : decision.kind === 'hub' &&
          replacement.kind === 'hub' &&
          decision.hubKey === replacement.hubKey
        ? replacement
        : decision.kind === 'localVisit' &&
            replacement.kind === 'localVisit' &&
            decision.sourceOccurrenceId === replacement.sourceOccurrenceId &&
            decision.groupKey === replacement.groupKey
          ? replacement
          : decision,
  );
  return Object.freeze({ ...topology, decisions: Object.freeze(decisions) });
}

export function appendDecision(
  topology: BiomeTopology,
  decision: ExitDecision | HubDecision | LocalVisitDecision,
): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze([...topology.decisions, decision]),
  });
}

export function defaultOccurrence(
  catalog: Catalog,
  room: RoomDeclaration,
  occurrenceId: OccurrenceId,
  role: RoomOccurrenceRole,
  entryActive: boolean,
  resolvedStoreKey: string | undefined,
  loadout: { readonly weaponKey: string; readonly aspectKey: string },
  activeCageCount?: number,
): RoomOccurrence {
  const state = createDefaultRoomState(catalog, room, {
    role,
    entryActive,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    loadout,
    ...(activeCageCount === undefined ? {} : { activeCageCount }),
  });
  const encounters = createDefaultRoomEncounterState(
    catalog,
    room,
    `occurrences.${occurrenceId}.encounters`,
  );
  return Object.freeze({
    occurrenceId,
    gameName: room.gameName,
    state,
    ...(state.kind === 'shop' && state.shop !== undefined
      ? { acquisitionSites: Object.freeze({ roomExit: Object.freeze({}) }) }
      : {}),
    encounters,
    roomActions: createDefaultRoomActionState(room),
    additionalExits: Object.freeze([]),
    ...(room.purgingPool === undefined
      ? {}
      : {
          purgingPool: Object.freeze({
            interacted: false,
            traitKeyBySlot: Object.freeze({ left: null, middle: null, right: null }),
          }),
        }),
    ...(room.surfaceShop?.forced === true
      ? {
          hermesShrine: Object.freeze({
            offerBySlot: Object.freeze({ first: null, secondLeft: null, secondRight: null }),
          }),
        }
      : {}),
    ...(room.roomShop?.forced === true
      ? {
          stygianWell: Object.freeze({
            interacted: false,
            offerKeyBySlot: Object.freeze({ healing: null, secondLeft: null, secondRight: null }),
          }),
        }
      : {}),
  });
}

export function resolvedStoreKey(rewardStore: BatchRewardStoreState): string | undefined {
  return rewardStore.kind === 'authoredBaseStore'
    ? (rewardStore.baseRewardStoreKey ?? undefined)
    : undefined;
}

export function appendOccurrence(
  topology: BiomeTopology,
  occurrence: RoomOccurrence,
  command: TopologyCommand,
): BiomeTopology {
  if (
    topology.occurrences.some((candidate) => candidate.occurrenceId === occurrence.occurrenceId)
  ) {
    failCommand(command, `occurrence ${occurrence.occurrenceId} already exists`);
  }
  return Object.freeze({
    ...topology,
    occurrences: Object.freeze([...topology.occurrences, occurrence]),
  });
}

export function expectedPrebossRole(
  room: RoomDeclaration,
  index: number,
  command: TopologyCommand,
): RoomOccurrenceRole {
  if (room.kind !== 'Preboss' || room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') {
    failCommand(command, `${room.gameName} is not a takeover Preboss declaration`);
  }
  if (index === 0) return 'prebossShop';
  if (room.prebossBatchPolicy.remainingOffers.kind !== 'counted') {
    failCommand(command, `${room.gameName} has no remaining-offer policy`);
  }
  return 'prebossFreeReward';
}

export function updateTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  topology: BiomeTopology,
): ProjectDocument {
  return withBiome(document, located, { ...located.plan, topology });
}
