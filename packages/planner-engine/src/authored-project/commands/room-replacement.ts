import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type {
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import type { RoomOccurrenceRole, RoomStateContext } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { reconcileReplacementRoomState } from '../room-state/replacement';
import { selectedExitKey, selectedOrdinaryBatchIndex } from '../topology/query';

import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  type LocatedBiome,
} from './contract';
import { replaceOccurrence, updateOccurrenceTopology } from './occurrence-mutation';
import type { RoomReplacementCommand } from './types';

function resolvedBatchStore(
  topology: BiomeTopology,
  decision: ExitDecision,
  command: RoomReplacementCommand,
): string | undefined {
  if (decision.normal.kind !== 'batch') return undefined;
  if (decision.normal.rewardStore.kind === 'authoredBaseStore') {
    return decision.normal.rewardStore.baseRewardStoreKey ?? undefined;
  }
  if (decision.normal.rewardStore.kind === 'none') return undefined;
  if (decision.source.kind !== 'occurrence') {
    failCommand(command, 'a Hub batch cannot derive a source reward wheel');
  }
  const sourceId = decision.source.occurrenceId;
  const source = topology.occurrences.find((occurrence) => occurrence.occurrenceId === sourceId);
  if (source?.state.kind !== 'shipCombat') {
    failCommand(command, 'source-derived reward store requires ShipCombat source state');
  }
  const wheel = source.state.wheels[source.state.encounterCount === 3 ? 'wheel2' : 'wheel1'];
  if (wheel === undefined) {
    failCommand(command, 'source-derived reward store is missing its active wheel');
  }
  return wheel.storeKey;
}

function incomingStore(
  topology: BiomeTopology,
  source: ExitDecisionSource,
  command: RoomReplacementCommand,
): string | undefined {
  if (source.kind !== 'occurrence') return undefined;
  const owner = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.some((target) => target.occurrenceId === source.occurrenceId),
  );
  return owner === undefined ? undefined : resolvedBatchStore(topology, owner, command);
}

function prebossRole(
  room: RoomDeclaration,
  targetIndex: number,
  command: RoomReplacementCommand,
): RoomOccurrenceRole {
  if (room.kind !== 'Preboss') return 'ordinary';
  const policy = room.prebossBatchPolicy;
  if (policy === undefined) failCommand(command, `${room.gameName} has no Preboss batch policy`);
  if (policy.kind === 'retainNormalPeers' || targetIndex === 0) return 'prebossShop';
  if (policy.remainingOffers.kind !== 'counted') {
    failCommand(command, `${room.gameName} has no remaining Preboss offer for this exit`);
  }
  return 'prebossFreeReward';
}

interface OccurrenceContext {
  readonly role: RoomOccurrenceRole;
  readonly entryActive: boolean;
  readonly resolvedStoreKey?: string;
  readonly owner?: ExitDecision;
}

function occurrenceContext(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  command: RoomReplacementCommand,
  replacementRoom?: RoomDeclaration,
): OccurrenceContext {
  if (topology.startOccurrenceId === occurrenceId) {
    return Object.freeze({ role: 'ordinary', entryActive: true });
  }
  for (const decision of topology.decisions) {
    if (decision.kind === 'hub') {
      if (decision.openTargets.some((target) => target.occurrenceId === occurrenceId)) {
        return Object.freeze({
          role: 'ordinary',
          entryActive: decision.openTargets.some(
            (target) =>
              target.occurrenceId === occurrenceId &&
              decision.visitOrder.includes(target.hubSlotKey),
          ),
        });
      }
      continue;
    }
    if (decision.normal.kind === 'linked' && decision.normal.occurrenceId === occurrenceId) {
      return Object.freeze({ role: 'ordinary', entryActive: true, owner: decision });
    }
    if (decision.normal.kind !== 'batch') continue;
    const targetIndex = decision.normal.targets.findIndex(
      (target) => target.occurrenceId === occurrenceId,
    );
    if (targetIndex < 0) continue;
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    const room =
      replacementRoom ??
      (occurrence === undefined
        ? undefined
        : requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command));
    if (room === undefined) failCommand(command, `unknown occurrence ${occurrenceId}`);
    const role = prebossRole(room, targetIndex, command);
    const target = decision.normal.targets[targetIndex];
    const resolvedStoreKey =
      role === 'prebossFreeReward'
        ? (room.forcedRewardStoreKey ??
          room.individualRewardStoreKey ??
          incomingStore(topology, decision.source, command))
        : resolvedBatchStore(topology, decision, command);
    return Object.freeze({
      role,
      entryActive: target?.exitKey === selectedExitKey(decision),
      ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
      owner: decision,
    });
  }
  failCommand(command, `occurrence ${occurrenceId} has no structural owner`);
}

function asRoomStateContext(context: OccurrenceContext): RoomStateContext {
  return Object.freeze({
    role: context.role,
    entryActive: context.entryActive,
    ...(context.resolvedStoreKey === undefined
      ? {}
      : { resolvedStoreKey: context.resolvedStoreKey }),
  });
}

function requireOrdinaryBatchTarget(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  replacement: RoomDeclaration,
  command: RoomReplacementCommand,
): void {
  const context = occurrenceContext(topology, catalog, located, occurrenceId, command, replacement);
  if (context.owner === undefined || context.owner.normal.kind !== 'batch') return;
  const ownerTargets = context.owner.normal.targets.map((target) => {
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    return occurrence?.occurrenceId === occurrenceId
      ? replacement
      : occurrence === undefined
        ? undefined
        : catalog.rooms.byKey[occurrence.gameName];
  });
  if (ownerTargets.some((room) => room?.prebossBatchPolicy?.kind === 'takeOverNormalDoors')) {
    failCommand(
      command,
      'takeover Preboss targets can only change through their atomic batch command',
    );
  }
  if (
    replacement.kind === 'Intro' ||
    replacement.kind === 'Opening' ||
    replacement.kind === 'PreHub'
  ) {
    failCommand(command, `${replacement.gameName} is not an ordinary normal-door target`);
  }
  if (replacement.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
    failCommand(command, 'takeover Preboss targets require an atomic takeover batch command');
  }
  if (
    located.layout.progression.kind === 'generated' &&
    located.layout.progression.progressionPolicy.kind === 'staged'
  ) {
    const batchIndex =
      context.owner.source.kind === 'occurrence'
        ? selectedOrdinaryBatchIndex(topology, context.owner.source.occurrenceId)
        : undefined;
    const stage =
      batchIndex === undefined
        ? undefined
        : located.layout.progression.progressionPolicy.stages[batchIndex];
    if (stage === undefined || !stage.roomGameNames.includes(replacement.gameName)) {
      failCommand(
        command,
        `${replacement.gameName} is not available in stage ${stage?.key ?? '?'}`,
      );
    }
  }
}

function reconcileSourceRewardStore(
  topology: BiomeTopology,
  located: LocatedBiome,
  occurrenceId: OccurrenceId,
  replacementRoom: RoomDeclaration,
): BiomeTopology {
  if (located.layout.progression.kind !== 'generated') return topology;
  const policy =
    located.layout.progression.rewardStoreOverrides.find(
      (override) => override.sourceEncounterProfileKey === replacementRoom.encounterProfileKey,
    )?.policy ?? located.layout.progression.rewardStorePolicy;
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(
      topology.decisions.map((decision) => {
        if (
          decision.kind !== 'exit' ||
          decision.source.kind !== 'occurrence' ||
          decision.source.occurrenceId !== occurrenceId ||
          decision.normal.kind !== 'batch'
        ) {
          return decision;
        }
        const current = decision.normal.rewardStore;
        const rewardStore =
          policy.kind === 'authoredBaseStore' &&
          current.kind === 'authoredBaseStore' &&
          (current.baseRewardStoreKey === null ||
            policy.storeKeys.includes(current.baseRewardStoreKey))
            ? current
            : policy.kind === 'authoredBaseStore'
              ? Object.freeze({ kind: 'authoredBaseStore' as const, baseRewardStoreKey: null })
              : Object.freeze({ kind: policy.kind });
        return rewardStore === current
          ? decision
          : Object.freeze({
              ...decision,
              normal: Object.freeze({ ...decision.normal, rewardStore }),
            });
      }),
    ),
  });
}

export function applyRoomReplacementCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: RoomReplacementCommand,
): ProjectDocument {
  const current = requireTopology(located.plan, command);
  const occurrence = requireOccurrence(located.plan, command.occurrence.occurrenceId, command);
  if (occurrence.gameName === command.gameName) return document;
  const replacementRoom = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  if (current.startOccurrenceId === occurrence.occurrenceId) {
    const allowed =
      located.layout.start.kind === 'authoredChoice'
        ? located.layout.start.roomGameNames
        : [located.layout.start.roomGameName];
    if (!allowed.includes(replacementRoom.gameName)) {
      failCommand(command, `${replacementRoom.gameName} is not a declared start room`);
    }
  }
  const linked = current.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'linked' &&
      decision.normal.occurrenceId === occurrence.occurrenceId,
  );
  if (linked !== undefined) {
    const expected =
      located.layout.progression.kind === 'hub'
        ? located.layout.progression.linkedExit.roomGameName
        : undefined;
    if (replacementRoom.gameName !== expected) {
      failCommand(command, 'linked target identity is declaration-fixed');
    }
  }
  const hubTarget = current.decisions.find(
    (decision) =>
      decision.kind === 'hub' &&
      decision.openTargets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
  if (hubTarget !== undefined) failCommand(command, 'Hub slot identity is declaration-fixed');
  requireOrdinaryBatchTarget(
    current,
    catalog,
    located,
    occurrence.occurrenceId,
    replacementRoom,
    command,
  );
  if (
    replacementRoom.kind === 'Preboss' &&
    current.decisions.some(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === occurrence.occurrenceId,
    )
  ) {
    failCommand(command, 'remove the downstream exit decision before selecting a Preboss room');
  }
  const context = occurrenceContext(
    current,
    catalog,
    located,
    occurrence.occurrenceId,
    command,
    replacementRoom,
  );
  const replacementDefault = createDefaultRoomState(
    catalog,
    replacementRoom,
    asRoomStateContext(context),
  );
  const replacement: RoomOccurrence = Object.freeze({
    occurrenceId: occurrence.occurrenceId,
    gameName: replacementRoom.gameName,
    state: reconcileReplacementRoomState(
      catalog,
      requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command),
      occurrence.state,
      replacementRoom,
      replacementDefault,
    ),
  });
  return updateOccurrenceTopology(
    document,
    located,
    reconcileSourceRewardStore(
      replaceOccurrence(current, replacement),
      located,
      occurrence.occurrenceId,
      replacementRoom,
    ),
  );
}
