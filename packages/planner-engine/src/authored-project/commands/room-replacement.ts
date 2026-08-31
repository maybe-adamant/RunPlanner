import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import type {
  AuthoredAcquisitionSiteState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { createBiomeAddress, createOccurrenceAddress } from '../addresses';
import { authoredAcquisitionSources } from '../acquisition-sources';
import {
  acquisitionSiteStorageKey,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
} from '../artificer';
import type { RoomOccurrenceRole, RoomStateContext } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { reconcileRoomEncounterState } from '../room-state/encounter-reconciliation';
import { createDefaultRoomEncounterState } from '../room-state/encounter-envelope';
import { createInfernalContractEntries } from '../shop';
import { activeRoomActionReferences, roomActionKey } from '../room-actions';
import { reconcileReplacementRoomState } from '../room-state/replacement';
import {
  normalDecisionProgressionForLayout,
  selectedExitKey,
  selectedOrdinaryBatchIndex,
} from '../topology/query';
import { fieldsDefaultActiveCageCount } from '../fields';

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

function reconcileReplacementAcquisitionSites(
  located: LocatedBiome,
  previous: RoomOccurrence,
  replacement: RoomOccurrence,
): Readonly<Record<string, AuthoredAcquisitionSiteState>> | undefined {
  const biome = createBiomeAddress(located.routeKey, located.layout.biomeKey);
  const owner = createOccurrenceAddress(biome, replacement.occurrenceId);
  const sites: Record<string, AuthoredAcquisitionSiteState> = {
    ...(replacement.acquisitionSites ?? {}),
  };
  for (const source of authoredAcquisitionSources(biome, replacement)) {
    const sourceOwner = source.acquisition.owner;
    const role = source.acquisition.acquisitionRole;
    if (source.reward.dispositionByAcquisitionRole[role]?.kind !== 'artificer') continue;
    const siteKey = acquisitionSiteStorageKey(artificerAcquisitionSite(owner, sourceOwner));
    const entryKey = artificerReplacementEntryKey(sourceOwner, role);
    const previousEntries = previous.acquisitionSites?.[siteKey]?.pickupEntries;
    if (previousEntries === undefined || !Object.hasOwn(previousEntries, entryKey)) continue;
    const current = sites[siteKey];
    sites[siteKey] = Object.freeze({
      ...current,
      pickupEntries: Object.freeze({
        ...(current?.pickupEntries ?? {}),
        [entryKey]: previousEntries[entryKey]!,
      }),
    });
  }
  return Object.keys(sites).length === 0 ? undefined : Object.freeze(sites);
}

function reconcileReplacementRoomLocalState(
  catalog: Catalog,
  located: LocatedBiome,
  previous: RoomOccurrence,
  replacement: RoomOccurrence,
): RoomOccurrence {
  const acquisitionSites = reconcileReplacementAcquisitionSites(located, previous, replacement);
  const withSites = Object.freeze({
    ...replacement,
    ...(acquisitionSites === undefined ? {} : { acquisitionSites }),
    roomActions: previous.roomActions,
  });
  const biome = createBiomeAddress(located.routeKey, located.layout.biomeKey);
  const activeKeys = new Set(
    activeRoomActionReferences(catalog, biome, withSites).map(roomActionKey),
  );
  return Object.freeze({
    ...withSites,
    roomActions: Object.freeze({
      order: Object.freeze(
        previous.roomActions.order.filter((reference) => activeKeys.has(roomActionKey(reference))),
      ),
    }),
  });
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
    if (decision.kind === 'localVisit') {
      if (
        Object.values(decision.targetsBySlot).some((target) => target.occurrenceId === occurrenceId)
      ) {
        return Object.freeze({
          role: 'ordinary',
          entryActive: decision.visitOrder.includes(occurrenceId),
        });
      }
      continue;
    }
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

function asRoomStateContext(
  context: OccurrenceContext,
  loadout: LocatedBiome['loadout'],
  activeCageCount?: number,
): RoomStateContext {
  return Object.freeze({
    role: context.role,
    entryActive: context.entryActive,
    loadout,
    ...(activeCageCount === undefined ? {} : { activeCageCount }),
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
    replacement.kind === 'Boss' ||
    replacement.kind === 'Intro' ||
    replacement.kind === 'Opening' ||
    replacement.kind === 'PostBoss'
  ) {
    failCommand(command, `${replacement.gameName} is not an ordinary normal-door target`);
  }
  if (replacement.kind === 'PreHub' && located.layout.progression.kind !== 'hub') {
    failCommand(command, `${replacement.gameName} is not an ordinary normal-door target`);
  }
  if (replacement.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
    failCommand(command, 'takeover Preboss targets require an atomic takeover batch command');
  }
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression?.progressionPolicy.kind === 'staged') {
    const batchIndex =
      context.owner.source.kind === 'occurrence'
        ? selectedOrdinaryBatchIndex(topology, context.owner.source.occurrenceId)
        : undefined;
    const stage =
      batchIndex === undefined ? undefined : progression.progressionPolicy.stages[batchIndex];
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
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined) return topology;
  const sourceRoomTemplateKey =
    replacementRoom.mode.kind === 'authored' ? replacementRoom.mode.templateKey : undefined;
  const policy =
    (sourceRoomTemplateKey === undefined
      ? undefined
      : progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy) ?? progression.rewardStorePolicy;
  return Object.freeze({
    ...topology,
    decisions: Object.freeze(
      topology.decisions.map((decision) => {
        if (
          decision.kind !== 'exit' ||
          decision.source.kind !== 'occurrence' ||
          decision.source.occurrenceId !== occurrenceId
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
  if (
    replacementRoom.kind === 'Preboss' &&
    catalog.routes.byKey[located.routeKey]?.prebossRoomGameNames?.[located.biomeIndex] !==
      replacementRoom.gameName
  ) {
    failCommand(
      command,
      `${replacementRoom.gameName} is not this route position's declared Preboss`,
    );
  }
  if (current.startOccurrenceId === occurrence.occurrenceId) {
    const allowed =
      located.layout.start.kind === 'authoredChoice'
        ? located.layout.start.roomGameNames
        : [located.layout.start.roomGameName];
    if (!allowed.includes(replacementRoom.gameName)) {
      failCommand(command, `${replacementRoom.gameName} is not a declared start room`);
    }
  }
  const hubTarget = current.decisions.find(
    (decision) =>
      decision.kind === 'hub' &&
      decision.openTargets.some((target) => target.occurrenceId === occurrence.occurrenceId),
  );
  if (hubTarget !== undefined) failCommand(command, 'Hub slot identity is declaration-fixed');
  const localVisitTarget = current.decisions.find(
    (decision) =>
      decision.kind === 'localVisit' &&
      Object.values(decision.targetsBySlot).some(
        (target) => target.occurrenceId === occurrence.occurrenceId,
      ),
  );
  if (localVisitTarget !== undefined) {
    failCommand(command, 'local visit slot identity is declaration-fixed');
  }
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
    asRoomStateContext(
      context,
      located.loadout,
      context.owner === undefined
        ? undefined
        : fieldsDefaultActiveCageCount({
            catalog,
            layout: located.layout,
            topology: current,
            decision: context.owner,
            room: replacementRoom,
            replacingOccurrenceId: occurrence.occurrenceId,
          }),
    ),
  );
  const replacementState = reconcileReplacementRoomState(
    catalog,
    requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command),
    occurrence.state,
    replacementRoom,
    replacementDefault,
  );
  const replacementDraft: RoomOccurrence = Object.freeze({
    occurrenceId: occurrence.occurrenceId,
    gameName: replacementRoom.gameName,
    ...(occurrence.fountainRarityResult !== undefined &&
    (replacementRoom.hasRequiredFountain ||
      (replacementRoom.mode.kind === 'authored' && replacementRoom.mode.templateKey === 'Fountain'))
      ? { fountainRarityResult: occurrence.fountainRarityResult }
      : {}),
    state: replacementState,
    ...(replacementState.kind === 'shop' && replacementState.shop !== undefined
      ? {
          acquisitionSites: Object.freeze({
            roomExit: Object.freeze({
              ...(replacementRoom.infernalContractReward === undefined
                ? {}
                : {
                    pickupEntries: createInfernalContractEntries(catalog, replacementRoom.gameName),
                  }),
            }),
          }),
        }
      : {}),
    encounters: reconcileRoomEncounterState(
      catalog,
      requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command),
      occurrence.encounters,
      replacementRoom,
      createDefaultRoomEncounterState(
        catalog,
        replacementRoom,
        `occurrences.${occurrence.occurrenceId}.encounters`,
      ),
    ),
    roomActions: occurrence.roomActions,
    additionalExits: occurrence.additionalExits ?? Object.freeze([]),
  });
  const replacement = reconcileReplacementRoomLocalState(
    catalog,
    located,
    occurrence,
    replacementDraft,
  );
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
