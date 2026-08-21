import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { createInitialBatchRewardStore, createInitialExitDecision } from '../batchState';
import {
  applyTopologyRemovalImpact,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubDecisionRemovalImpact,
  describeHubSlotClosureImpact,
  describeTopologyRemovalImpact,
} from '../topologyImpact';
import type { ExitDecisionSourceAddress } from '../addresses';
import type {
  BatchRewardStoreState,
  BiomeTopology,
  ExitDecision,
  ExitDecisionSource,
  ExitSelection,
  ExitTargetReference,
  HubDecision,
  LocalVisitDecision,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { requireEphyraSideRooms, type RoomOccurrenceRole } from '../room-state/declaration';
import { createDefaultRoomState } from '../room-state/defaults';
import { createDefaultRoomEncounterState } from '../room-state/encounters';
import { createSelectedPickupEntries, selectedPickupProducer } from '../traits';
import {
  admitsTerminalTakeoverEnvelope,
  hostContinuationExitForDetourRoom,
  additionalExitsForDecision,
  declaredPhysicalExitKeys,
  exitDecisionForSource,
  hubDecisionHandoffReadiness,
  hubTerminalTakeoverForSource,
  isExactTerminalTakeoverEnvelope,
  normalDecisionProgressionForLayout,
  ordinaryBatchCreationEligibility,
  ordinaryTargetAuthoringEligibility,
  selectedExitContinuation,
  selectedExitKey,
} from '../topology/query';
import { fieldsDefaultActiveCageCount } from '../fields';
import { createEmptyRoomActionState } from '../room-actions';
import { createInfernalContractEntries } from '../shop';
import {
  failCommand,
  locateBiome,
  requireOccurrence,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from './contract';
import type { TopologyCommand } from './types';
import { reconcileNormalTargetEntryStates } from './selection-state';

function sourceEquals(left: ExitDecisionSource, right: ExitDecisionSourceAddress): boolean {
  if (left.kind === 'occurrence' && right.kind === 'occurrence') {
    return left.occurrenceId === right.occurrenceId;
  }
  return (
    left.kind === 'hubDecision' &&
    right.kind === 'hubDecision' &&
    left.decisionKey === right.decisionKey
  );
}

function sourceFromAddress(source: ExitDecisionSourceAddress): ExitDecisionSource {
  return source.kind === 'occurrence'
    ? Object.freeze({ kind: 'occurrence', occurrenceId: source.occurrenceId })
    : Object.freeze({ kind: 'hubDecision', decisionKey: source.decisionKey });
}

function exitKeysForSource(
  catalog: Catalog,
  located: LocatedBiome,
  source: ExitDecisionSourceAddress,
  command: TopologyCommand,
): readonly string[] {
  const topology = located.plan.topology;
  if (topology === null) failCommand(command, 'normal-door source requires topology');
  const declared = declaredPhysicalExitKeys(catalog, located.layout, topology, source);
  if (declared === undefined) {
    failCommand(command, `${source.kind} source has no declaration-owned physical exits`);
  }
  return declared;
}

function sourceRoom(
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
  if (
    room.roomSetKey !== located.layout.biomeKey &&
    hostContinuationExitForDetourRoom(room) === undefined
  ) {
    failCommand(command, `${gameName} belongs to ${room.roomSetKey}`);
  }
  return room;
}

function replaceDecision(
  topology: BiomeTopology,
  replacement: ExitDecision | HubDecision | LocalVisitDecision,
): BiomeTopology {
  const decisions = topology.decisions.map((decision) =>
    decision.kind === 'exit' && replacement.kind === 'exit'
      ? sourceEquals(decision.source, replacement.source)
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

function appendDecision(
  topology: BiomeTopology,
  decision: ExitDecision | HubDecision | LocalVisitDecision,
): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze([...topology.decisions, decision]),
  });
}

function localVisitDecisionForSource(
  topology: BiomeTopology,
  sourceOccurrenceId: OccurrenceId,
  groupKey: string,
): LocalVisitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is LocalVisitDecision =>
      decision.kind === 'localVisit' &&
      decision.sourceOccurrenceId === sourceOccurrenceId &&
      decision.groupKey === groupKey,
  );
}

/**
 * A target may only own a subsequent decision while it remains on the selected
 * spine. Structural replacement and capacity repair remove that downstream
 * subtree explicitly; no command leaves a now-dead target as a decision source.
 */
function removeDownstreamDecisions(
  topology: BiomeTopology,
  sourceOccurrenceIds: ReadonlySet<OccurrenceId>,
): BiomeTopology {
  return applyTopologyRemovalImpact(
    topology,
    describeTopologyRemovalImpact(topology, sourceOccurrenceIds),
  );
}

/**
 * A completed Hub owns one fixed width-one Preboss handoff. Reducing the
 * visit sequence below its declared completion requirement must remove that
 * handoff and its target subtree in the same semantic edit; otherwise the
 * persisted topology would retain an invalid Hub-source exit.
 */
function removeCompletedHubHandoff(topology: BiomeTopology, hubKey: string): BiomeTopology {
  const impact = describeExitDecisionRemovalImpact(topology, {
    kind: 'hubDecision',
    decisionKey: hubKey,
  });
  return impact === undefined ? topology : applyTopologyRemovalImpact(topology, impact);
}

function defaultOccurrence(
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
  const pickupProducer = selectedPickupProducer(catalog, encounters);
  const pickupEntries =
    pickupProducer === undefined
      ? Object.freeze({})
      : createSelectedPickupEntries(catalog, pickupProducer);
  const contractEntries = createInfernalContractEntries(catalog, room.gameName);
  return Object.freeze({
    occurrenceId,
    gameName: room.gameName,
    state,
    ...(state.kind === 'shop' && state.shop !== undefined
      ? {
          acquisitionSites: Object.freeze({
            roomExit: Object.freeze({
              ...(Object.keys(contractEntries).length === 0
                ? {}
                : { pickupEntries: contractEntries }),
            }),
          }),
        }
      : Object.keys(pickupEntries).length > 0
        ? {
            acquisitionSites: Object.freeze({
              roomExit: Object.freeze({ pickupEntries }),
            }),
          }
        : {}),
    encounters,
    roomActions: createEmptyRoomActionState(),
    additionalExits: Object.freeze([]),
  });
}

function resolvedStoreKey(rewardStore: BatchRewardStoreState): string | undefined {
  return rewardStore.kind === 'authoredBaseStore'
    ? (rewardStore.baseRewardStoreKey ?? undefined)
    : undefined;
}

function sourceIncomingStore(
  topology: BiomeTopology,
  source: ExitDecisionSourceAddress,
): string | undefined {
  if (source.kind !== 'occurrence') return undefined;
  const owner = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.normal.kind === 'batch' &&
      decision.normal.targets.some((target) => target.occurrenceId === source.occurrenceId),
  );
  return owner?.normal.kind === 'batch' ? resolvedStoreKey(owner.normal.rewardStore) : undefined;
}

function prebossFreeRewardStore(
  room: RoomDeclaration,
  incomingStore: string | undefined,
): string | undefined {
  return room.forcedRewardStoreKey ?? room.individualRewardStoreKey ?? incomingStore;
}

function orderTargetsByPhysicalExit(
  targets: readonly ExitTargetReference[],
  exitKeys: readonly string[],
): readonly ExitTargetReference[] {
  return Object.freeze(
    [...targets].sort(
      (left, right) => exitKeys.indexOf(left.exitKey) - exitKeys.indexOf(right.exitKey),
    ),
  );
}

function appendOccurrence(
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

function expectedPrebossRole(
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

function compatiblePrebossOccurrence(
  occurrence: RoomOccurrence,
  room: RoomDeclaration,
  role: RoomOccurrenceRole,
  entryActive: boolean,
): boolean {
  if (occurrence.gameName !== room.gameName) return false;
  if (role !== 'prebossShop') return occurrence.state.kind === 'freeReward';
  return occurrence.state.kind === 'shop' && (occurrence.state.shop !== undefined) === entryActive;
}

function updateTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  topology: BiomeTopology,
): ProjectDocument {
  return withBiome(document, located, { ...located.plan, topology });
}

function createStart(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'CreateStart' }>,
): ProjectDocument {
  if (located.plan.topology !== null)
    failCommand(command, 'topology already has a start occurrence');
  const gameName =
    located.layout.start.kind === 'authoredChoice'
      ? command.gameName
      : located.layout.start.roomGameName;
  if (located.layout.start.kind === 'authoredChoice') {
    if (gameName === undefined || !located.layout.start.roomGameNames.includes(gameName)) {
      failCommand(command, 'gameName must select one declared authored start');
    }
  } else if (command.gameName !== undefined) {
    failCommand(command, 'fixed authored starts derive their declaration-owned gameName');
  }
  if (gameName === undefined) failCommand(command, 'missing declared authored start');
  const room = requireRoom(catalog, gameName, located.layout.biomeKey, command);
  const occurrence = defaultOccurrence(
    catalog,
    room,
    command.occurrenceId,
    'ordinary',
    true,
    undefined,
    located.loadout,
  );
  return withBiome(document, located, {
    ...located.plan,
    topology: Object.freeze({
      startOccurrenceId: command.occurrenceId,
      occurrences: Object.freeze([occurrence]),
      decisions: Object.freeze([]),
    }),
  });
}

function createBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'CreateBatch' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined) failCommand(command, 'layout has no normal-door decision policy');
  if (command.decision.source.kind === 'hubDecision') {
    failCommand(command, 'the completed Hub emits its declaration-fixed takeover batch');
  }
  if (exitDecisionForSource(topology, command.decision.source) !== undefined)
    failCommand(command, 'exit decision already exists');
  const room = sourceRoom(catalog, located, command.decision.source, command);
  if (room?.kind === 'Preboss')
    failCommand(command, 'a selected Preboss closes editable traversal');
  const batchEligibility = ordinaryBatchCreationEligibility(catalog, located.layout, topology);
  if (batchEligibility.kind === 'notGenerated') {
    failCommand(command, 'layout has no normal-door decision policy');
  }
  if (
    batchEligibility.kind === 'ordinaryBatchLimitReached' &&
    !admitsTerminalTakeoverEnvelope(
      catalog,
      located.layout,
      topology,
      sourceFromAddress(command.decision.source),
    )
  ) {
    failCommand(command, 'normal progression has reached its declaration-owned batch bound');
  }
  const decision = createInitialExitDecision(
    progression,
    sourceFromAddress(command.decision.source),
    room?.mode.kind === 'authored' ? room.mode.templateKey : undefined,
  );
  return updateTopology(document, located, appendDecision(topology, decision));
}

/**
 * Persists the projected frontier envelope and its first semantic edit as one
 * domain command. The intermediate empty decision is never published, so one
 * history entry and one undo restore the uncommitted frontier.
 */
function initializeExitDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'InitializeExitDecision' }>,
): ProjectDocument {
  if (
    command.edit.kind === 'target' &&
    (command.edit.target.routeKey !== command.decision.routeKey ||
      command.edit.target.biomeKey !== command.decision.biomeKey ||
      !sourceEquals(sourceFromAddress(command.decision.source), command.edit.target.source))
  ) {
    failCommand(command, 'initial target must belong to the initialized exit decision');
  }
  const created = createBatch(document, catalog, located, {
    kind: 'CreateBatch',
    decision: command.decision,
  });
  const nextLocated = locateBiome(created, catalog, command);
  switch (command.edit.kind) {
    case 'hub':
      return replaceWithHubDecision(created, catalog, nextLocated, {
        kind: 'ReplaceWithHubDecision',
        decision: command.decision,
        hub: command.edit.hub,
      });
    case 'rewardStore':
      return replaceBatchRewardStore(created, catalog, nextLocated, {
        kind: 'ReplaceBatchRewardStore',
        rewardStore: { ...command.decision, kind: 'batchRewardStore' },
        storeKey: command.edit.storeKey,
      });
    case 'fieldsCageOutcome':
      return replaceFieldsCageOutcome(created, catalog, nextLocated, {
        kind: 'ReplaceFieldsCageOutcome',
        decision: command.decision,
        cageOutcome: command.edit.cageOutcome,
      });
    case 'target':
      return createTarget(created, catalog, nextLocated, {
        kind: 'CreateTarget',
        target: command.edit.target,
        occurrenceId: command.edit.occurrenceId,
        gameName: command.edit.gameName,
      });
  }
}

function failUnavailableOrdinaryTarget(
  command: Extract<TopologyCommand, { readonly kind: 'CreateTarget' }>,
  eligibility: Exclude<
    ReturnType<typeof ordinaryTargetAuthoringEligibility>,
    { readonly kind: 'authorable' }
  >,
): never {
  switch (eligibility.reason) {
    case 'notGenerated':
      return failCommand(command, 'layout has no normal-door target policy');
    case 'sourceIsHub':
      return failCommand(command, 'the completed Hub emits its declaration-fixed takeover batch');
    case 'missingBatch':
      return failCommand(command, 'normal-door batch does not exist');
    case 'takeoverBatch':
      return failCommand(command, 'takeover Preboss batches cannot receive ordinary targets');
    case 'targetIsNotDeclared':
      return failCommand(command, `${command.target.exitKey} is not declared by this source`);
    case 'targetAlreadyAuthored':
      return failCommand(command, `${command.target.exitKey} already has a target`);
    case 'notOrdinaryRoom':
      return failCommand(command, `${command.gameName} is not an ordinary normal-door target`);
    case 'takeoverRoom':
      return failCommand(
        command,
        'takeover Preboss targets require an atomic takeover batch command',
      );
    case 'duplicateRetainPeer':
      return failCommand(
        command,
        `${command.gameName} may appear only once in one normal-door batch`,
      );
    case 'batchBound':
      return failCommand(
        command,
        'normal progression has reached its declaration-owned batch bound',
      );
    case 'targetBound':
      return failCommand(
        command,
        'normal progression has reached its declaration-owned target bound',
      );
    case 'stage':
      return failCommand(
        command,
        `${command.gameName} is not available in stage ${eligibility.stageKey ?? '?'}`,
      );
    case 'unknownOrNonHostRoom':
      return failCommand(command, `${command.gameName} is not an authored room in this biome`);
  }
  const unhandled: never = eligibility.reason;
  return unhandled;
}

function createTarget(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'CreateTarget' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const room = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  const eligibility = ordinaryTargetAuthoringEligibility(
    catalog,
    located.layout,
    topology,
    command.target,
    room.gameName,
  );
  if (eligibility.kind !== 'authorable') failUnavailableOrdinaryTarget(command, eligibility);
  const decision = exitDecisionForSource(topology, command.target.source);
  if (decision?.normal.kind !== 'batch') {
    throw new Error('authorable ordinary target lost its normal-door batch');
  }
  const allowed = exitKeysForSource(catalog, located, command.target.source, command);
  if (!allowed.includes(command.target.exitKey)) {
    throw new Error('authorable ordinary target lost its declared physical exit');
  }
  if (topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId))
    failCommand(command, `occurrence ${command.occurrenceId} already exists`);
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    failCommand(command, 'select the batch reward store before authoring targets');
  }
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression?.batchPolicy.kind === 'fields' && decision.normal.batchState === null) {
    failCommand(command, 'select the Fields cage outcome before authoring targets');
  }
  const targets = orderTargetsByPhysicalExit(
    [
      ...decision.normal.targets,
      Object.freeze({ exitKey: command.target.exitKey, occurrenceId: command.occurrenceId }),
    ],
    allowed,
  );
  const selection: ExitSelection =
    targets.length === 1 && additionalExitsForDecision(topology, decision).length === 0
      ? Object.freeze({ kind: 'derived' })
      : decision.selection.kind === 'normal' || decision.selection.kind === 'additional'
        ? decision.selection
        : Object.freeze({ kind: 'unresolved' });
  const nextDecision: ExitDecision = Object.freeze({
    ...decision,
    normal: Object.freeze({ ...decision.normal, targets }),
    selection,
  });
  const previouslySelectedExitKey = selectedExitKey(decision);
  const nextSelectedExitKey = selectedExitKey(nextDecision);
  if (previouslySelectedExitKey !== nextSelectedExitKey) {
    const previousTarget = decision.normal.targets.find(
      (target) => target.exitKey === previouslySelectedExitKey,
    );
    if (
      previousTarget !== undefined &&
      topology.decisions.some(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === previousTarget.occurrenceId,
      )
    ) {
      failCommand(command, 'remove the prior selected target’s downstream decision first');
    }
  }
  const batchRewardStoreKey = resolvedStoreKey(decision.normal.rewardStore);
  const role: RoomOccurrenceRole = room.kind === 'Preboss' ? 'prebossShop' : 'ordinary';
  const withTarget = appendOccurrence(
    topology,
    defaultOccurrence(
      catalog,
      room,
      command.occurrenceId,
      role,
      nextSelectedExitKey === command.target.exitKey,
      batchRewardStoreKey,
      located.loadout,
      fieldsDefaultActiveCageCount({
        catalog,
        layout: located.layout,
        topology,
        decision,
        room,
      }),
    ),
    command,
  );
  const occurrences = withTarget.occurrences.map((occurrence) => {
    const targetIndex = targets.findIndex(
      (target) => target.occurrenceId === occurrence.occurrenceId,
    );
    if (targetIndex < 0) return occurrence;
    const targetRoom = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
    if (targetRoom.kind !== 'Preboss' && targetRoom.kind !== 'Shop') return occurrence;
    const targetRole: RoomOccurrenceRole =
      targetRoom.kind === 'Preboss' && targetRoom.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
        ? expectedPrebossRole(targetRoom, targetIndex, command)
        : targetRoom.kind === 'Preboss'
          ? 'prebossShop'
          : 'ordinary';
    if (targetRole !== 'prebossShop' && targetRoom.kind !== 'Shop') return occurrence;
    const entryActive = targets[targetIndex]?.exitKey === nextSelectedExitKey;
    const hasInventory = occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined;
    return hasInventory === entryActive
      ? occurrence
      : defaultOccurrence(
          catalog,
          targetRoom,
          occurrence.occurrenceId,
          targetRole,
          entryActive,
          batchRewardStoreKey,
          located.loadout,
        );
  });
  const next = replaceDecision(
    Object.freeze({ ...withTarget, occurrences: Object.freeze(occurrences) }),
    nextDecision,
  );
  return updateTopology(document, located, next);
}

function replaceTakeoverBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    { readonly kind: 'CreateTakeoverBatch' | 'ReplaceWithTakeoverBatch' | 'ReconcileTakeoverBatch' }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    (located.layout.progression.kind === 'hub' && command.decision.source.kind !== 'hubDecision') ||
    (located.layout.progression.kind === 'generated' &&
      command.decision.source.kind !== 'occurrence')
  ) {
    failCommand(command, 'takeover source does not match this progression');
  }
  if (command.decision.source.kind === 'hubDecision') {
    const hubSource = command.decision.source;
    if (located.layout.progression.kind !== 'hub') {
      failCommand(command, 'only a Hub progression has a completed-Hub exit');
    }
    const hub = topology.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === hubSource.decisionKey,
    );
    if (hubDecisionHandoffReadiness(located.layout.progression, hub).kind !== 'ready') {
      failCommand(
        command,
        'complete the declared Hub board and required visits before creating its Preboss batch',
      );
    }
  }
  const existing = exitDecisionForSource(topology, command.decision.source);
  if (command.kind === 'CreateTakeoverBatch' && existing !== undefined)
    failCommand(command, 'exit decision already exists');
  if (
    command.kind !== 'CreateTakeoverBatch' &&
    (existing === undefined || existing.normal.kind !== 'batch')
  )
    failCommand(command, 'normal-door batch does not exist');
  const room = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  if (room.prebossBatchPolicy?.kind !== 'takeOverNormalDoors')
    failCommand(command, `${room.gameName} is not a takeover Preboss declaration`);
  const exitKeys = exitKeysForSource(catalog, located, command.decision.source, command);
  const supplied = Object.keys(command.targetOccurrenceIds);
  if (
    supplied.length !== exitKeys.length ||
    exitKeys.some((exitKey) => command.targetOccurrenceIds[exitKey] === undefined)
  ) {
    failCommand(
      command,
      'takeover batch must provide one occurrence ID for every declaration-owned normal exit',
    );
  }
  const ids = exitKeys.map((exitKey) => command.targetOccurrenceIds[exitKey] as OccurrenceId);
  if (new Set(ids).size !== ids.length)
    failCommand(command, 'takeover target occurrence IDs must be unique');
  if (room.prebossBatchPolicy.remainingOffers.kind === 'none' && ids.length !== 1)
    failCommand(command, `${room.gameName} cannot fill remaining normal exits`);
  if (
    existing?.normal.kind === 'batch' &&
    existing.normal.targets.length === exitKeys.length &&
    existing.normal.targets.every(
      (target, index) =>
        target.exitKey === exitKeys[index] &&
        target.occurrenceId === ids[index] &&
        topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
          ?.gameName === room.gameName,
    )
  ) {
    return document;
  }
  const oldTargets = existing?.normal.kind === 'batch' ? existing.normal.targets : [];
  const occurrencesById = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const oldTargetByExitKey = new Map(oldTargets.map((target) => [target.exitKey, target]));
  const removed = new Set(oldTargets.map((target) => target.occurrenceId));
  const withoutDownstream = removeDownstreamDecisions(topology, removed);
  const retainedOccurrences = withoutDownstream.occurrences.filter(
    (occurrence) => !removed.has(occurrence.occurrenceId),
  );
  const selection: ExitSelection =
    ids.length === 1 &&
    (existing === undefined ? true : additionalExitsForDecision(topology, existing).length === 0)
      ? Object.freeze({ kind: 'derived' })
      : existing?.selection.kind === 'normal' && exitKeys.includes(existing.selection.exitKey)
        ? existing.selection
        : existing?.selection.kind === 'additional'
          ? existing.selection
          : Object.freeze({ kind: 'unresolved' });
  const targets = Object.freeze(
    exitKeys.map((exitKey, index) =>
      Object.freeze({ exitKey, occurrenceId: ids[index] as OccurrenceId }),
    ),
  );
  for (const target of targets) {
    const oldTarget = oldTargetByExitKey.get(target.exitKey);
    if (oldTarget !== undefined && target.occurrenceId !== oldTarget.occurrenceId) {
      failCommand(
        command,
        `takeover repair must retain ${target.exitKey} occurrence ${oldTarget.occurrenceId}`,
      );
    }
    if (oldTarget === undefined && occurrencesById.has(target.occurrenceId)) {
      failCommand(command, `occurrence ${target.occurrenceId} is already structurally owned`);
    }
  }
  const sourceRoomValue = sourceRoom(catalog, located, command.decision.source, command);
  const decision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: sourceFromAddress(command.decision.source),
    normal: Object.freeze({
      kind: 'batch',
      rewardStore:
        existing?.normal.kind === 'batch'
          ? existing.normal.rewardStore
          : createInitialBatchRewardStore(
              normalDecisionProgressionForLayout(located.layout) ??
                failCommand(command, 'layout has no normal-door decision policy'),
              sourceRoomValue?.mode.kind === 'authored'
                ? sourceRoomValue.mode.templateKey
                : undefined,
            ),
      batchState: null,
      targets,
    }),
    selection,
  });
  const selectedTakeoverExitKey = selectedExitKey(decision);
  const replacements = targets.map((target, index): RoomOccurrence => {
    const oldTarget = oldTargetByExitKey.get(target.exitKey);
    const role = expectedPrebossRole(room, index, command);
    const old = oldTarget === undefined ? undefined : occurrencesById.get(oldTarget.occurrenceId);
    const entryActive = target.exitKey === selectedTakeoverExitKey;
    return old !== undefined && compatiblePrebossOccurrence(old, room, role, entryActive)
      ? old
      : defaultOccurrence(
          catalog,
          room,
          target.occurrenceId,
          role,
          entryActive,
          role === 'prebossFreeReward'
            ? prebossFreeRewardStore(room, sourceIncomingStore(topology, command.decision.source))
            : undefined,
          located.loadout,
        );
  });
  const withoutOld =
    existing === undefined
      ? withoutDownstream
      : Object.freeze({
          ...withoutDownstream,
          decisions: Object.freeze(
            withoutDownstream.decisions.filter(
              (candidate) =>
                candidate.kind !== 'exit' ||
                !sourceEquals(candidate.source, command.decision.source),
            ),
          ),
        });
  const next = Object.freeze({
    ...withoutOld,
    occurrences: Object.freeze([
      ...retainedOccurrences,
      ...replacements.filter(
        (replacement) =>
          !retainedOccurrences.some(
            (occurrence) => occurrence.occurrenceId === replacement.occurrenceId,
          ),
      ),
    ]),
  });
  return updateTopology(document, located, appendDecision(next, decision));
}

function setExitSelection(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'SetExitSelection' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = exitDecisionForSource(topology, command.selection.source);
  if (decision === undefined || decision.normal.kind !== 'batch')
    failCommand(command, 'normal-door batch does not exist');
  const batch = decision.normal;
  const keys = batch.targets.map((target) => target.exitKey);
  const additionalExits = additionalExitsForDecision(topology, decision);
  const hasAdditional = additionalExits.length > 0;
  if (command.value.kind === 'derived' && (keys.length !== 1 || hasAdditional))
    failCommand(command, 'derived selection requires one normal exit');
  if (command.value.kind === 'unresolved' && keys.length === 1 && !hasAdditional)
    failCommand(command, 'width-one selection is declaration-derived');
  if (command.value.kind === 'normal' && keys.length === 1 && !hasAdditional)
    failCommand(command, 'width-one selection is declaration-derived');
  if (command.value.kind === 'normal' && !keys.includes(command.value.exitKey))
    failCommand(command, `${command.value.exitKey} is not a target exit`);
  if (command.value.kind === 'additional') {
    const { additionalExitKey } = command.value;
    if (!additionalExits.some((exit) => exit.key === additionalExitKey)) {
      failCommand(command, `${additionalExitKey} is not an authored additional exit`);
    }
  }
  const nextDecision = Object.freeze({ ...decision, selection: command.value });
  const previousContinuation = selectedExitContinuation(
    decision,
    additionalExitsForDecision(topology, decision),
  );
  const nextContinuation = selectedExitContinuation(
    nextDecision,
    additionalExitsForDecision(topology, nextDecision),
  );
  const selectedOccurrenceId = (continuation: ReturnType<typeof selectedExitContinuation>) =>
    continuation?.kind === 'normal'
      ? continuation.target.occurrenceId
      : continuation?.kind === 'additional'
        ? continuation.exit.occurrenceId
        : undefined;
  const nextSelectedOccurrenceId = selectedOccurrenceId(nextContinuation);
  const previousSelectedOccurrenceId = selectedOccurrenceId(previousContinuation);
  let selectionTopology = topology;
  if (previousSelectedOccurrenceId !== nextSelectedOccurrenceId) {
    const outgoing = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === previousSelectedOccurrenceId,
    );
    if (outgoing !== undefined) {
      if (previousContinuation?.kind !== 'normal' || nextContinuation?.kind !== 'normal') {
        failCommand(command, 'remove the prior selected target’s downstream decision first');
      }
      const previousOccurrence = requireOccurrence(
        located.plan,
        previousContinuation.target.occurrenceId,
        command,
      );
      const nextOccurrence = requireOccurrence(
        located.plan,
        nextContinuation.target.occurrenceId,
        command,
      );
      if (previousOccurrence.state.kind === 'anomaly' || nextOccurrence.state.kind === 'anomaly') {
        failCommand(command, 'remove the prior selected target’s downstream decision first');
      }
      const previousRoom = requireRoom(
        catalog,
        previousOccurrence.gameName,
        located.layout.biomeKey,
        command,
      );
      const nextRoom = requireRoom(
        catalog,
        nextOccurrence.gameName,
        located.layout.biomeKey,
        command,
      );
      const targetAlreadyOwnsDecision = topology.decisions.some(
        (candidate) =>
          candidate.kind === 'exit' &&
          candidate.source.kind === 'occurrence' &&
          candidate.source.occurrenceId === nextContinuation.target.occurrenceId,
      );
      if (
        outgoing.kind !== 'exit' ||
        previousRoom.kind === 'Preboss' ||
        nextRoom.kind === 'Preboss' ||
        targetAlreadyOwnsDecision
      ) {
        failCommand(command, 'remove the prior selected target’s downstream decision first');
      }
      const reanchored = Object.freeze({
        ...outgoing,
        source: Object.freeze({
          kind: 'occurrence' as const,
          occurrenceId: nextContinuation.target.occurrenceId,
        }),
      });
      selectionTopology = Object.freeze({
        ...topology,
        decisions: Object.freeze(
          topology.decisions.map((candidate) => (candidate === outgoing ? reanchored : candidate)),
        ),
      });
    }
  }
  const nextSelectedExitKey = selectedExitKey(nextDecision);
  const withSelectionState = reconcileNormalTargetEntryStates(
    catalog,
    located,
    selectionTopology,
    nextDecision,
    nextSelectedExitKey,
    command,
  );
  return updateTopology(document, located, replaceDecision(withSelectionState, nextDecision));
}

function replaceBatchRewardStore(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReplaceBatchRewardStore' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = exitDecisionForSource(topology, command.rewardStore.source);
  if (
    decision?.normal.kind !== 'batch' ||
    decision.normal.rewardStore.kind !== 'authoredBaseStore'
  ) {
    failCommand(command, 'normal-door batch does not expose an authored base reward store');
  }
  const source = sourceRoom(catalog, located, command.rewardStore.source, command);
  const progression = normalDecisionProgressionForLayout(located.layout);
  const sourceRoomTemplateKey =
    source?.mode.kind === 'authored' ? source.mode.templateKey : undefined;
  const policy =
    progression !== undefined && sourceRoomTemplateKey !== undefined
      ? (progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy ?? progression.rewardStorePolicy)
      : undefined;
  if (policy?.kind !== 'authoredBaseStore' || !policy.storeKeys.includes(command.storeKey)) {
    failCommand(command, `${command.storeKey} is not available from this batch policy`);
  }
  if (decision.normal.rewardStore.baseRewardStoreKey === command.storeKey) return document;
  return updateTopology(
    document,
    located,
    replaceDecision(
      topology,
      Object.freeze({
        ...decision,
        normal: Object.freeze({
          ...decision.normal,
          rewardStore: Object.freeze({
            kind: 'authoredBaseStore',
            baseRewardStoreKey: command.storeKey,
          }),
        }),
      }),
    ),
  );
}

function replaceFieldsCageOutcome(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReplaceFieldsCageOutcome' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const progression = normalDecisionProgressionForLayout(located.layout);
  if (progression === undefined || progression.batchPolicy.kind !== 'fields') {
    failCommand(command, 'batch does not expose a Fields cage outcome');
  }
  const decision = exitDecisionForSource(topology, command.decision.source);
  if (decision?.normal.kind !== 'batch') {
    failCommand(command, 'normal-door batch does not exist');
  }
  if (
    decision.normal.targets.some(
      (target) =>
        catalog.rooms.byKey[
          topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
            ?.gameName ?? ''
        ]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
    )
  ) {
    failCommand(command, 'takeover batches do not own Fields cage state');
  }
  if (decision.normal.batchState?.cageOutcome === command.cageOutcome) return document;
  return updateTopology(
    document,
    located,
    Object.freeze({
      ...topology,
      decisions: Object.freeze(
        topology.decisions.map((candidate) =>
          candidate === decision
            ? Object.freeze({
                ...candidate,
                normal: Object.freeze({
                  ...candidate.normal,
                  batchState: Object.freeze({ cageOutcome: command.cageOutcome }),
                }),
              })
            : candidate,
        ),
      ),
    }),
  );
}

function removeExitDecision(
  document: ProjectDocument,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'RemoveExitDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const impact = describeExitDecisionRemovalImpact(
    topology,
    sourceFromAddress(command.decision.source),
  );
  return impact === undefined
    ? document
    : updateTopology(document, located, applyTopologyRemovalImpact(topology, impact));
}

function clearTopology(
  document: ProjectDocument,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ClearTopology' }>,
): ProjectDocument {
  const topology = located.plan.topology;
  if (topology === null) return document;
  const cleared = applyTopologyRemovalImpact(topology, describeClearTopologyImpact(topology));
  if (cleared.occurrences.length !== 0 || cleared.decisions.length !== 0) {
    failCommand(command, 'ClearTopology impact must remove every persisted topology member');
  }
  return withBiome(document, located, { ...located.plan, topology: null });
}

function reconcileBatchExitCapacity(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = exitDecisionForSource(topology, command.decision.source);
  if (decision?.normal.kind !== 'batch') failCommand(command, 'normal-door batch does not exist');
  if (
    decision.normal.targets.some(
      (target) =>
        catalog.rooms.byKey[
          topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
            ?.gameName ?? ''
        ]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors',
    )
  ) {
    failCommand(command, 'takeover batches repair atomically through ReconcileTakeoverBatch');
  }
  const allowed = new Set(exitKeysForSource(catalog, located, command.decision.source, command));
  const retained = decision.normal.targets.filter((target) => allowed.has(target.exitKey));
  if (retained.length === decision.normal.targets.length) return document;
  const removed = new Set(
    decision.normal.targets
      .filter((target) => !allowed.has(target.exitKey))
      .map((target) => target.occurrenceId),
  );
  const withoutDownstream = removeDownstreamDecisions(topology, removed);
  let selection: ExitSelection = Object.freeze({ kind: 'unresolved' });
  const existingSelection = decision.selection;
  if (retained.length === 1 && additionalExitsForDecision(topology, decision).length === 0) {
    selection = Object.freeze({ kind: 'derived' });
  } else if (
    existingSelection.kind === 'normal' &&
    retained.some((target) => target.exitKey === existingSelection.exitKey)
  ) {
    selection = existingSelection;
  } else if (existingSelection.kind === 'additional') {
    selection = existingSelection;
  }
  return updateTopology(
    document,
    located,
    replaceDecision(
      Object.freeze({
        ...withoutDownstream,
        occurrences: Object.freeze(
          withoutDownstream.occurrences.filter(
            (occurrence) => !removed.has(occurrence.occurrenceId),
          ),
        ),
      }),
      Object.freeze({
        ...decision,
        normal: Object.freeze({ ...decision.normal, targets: Object.freeze(retained) }),
        selection,
      }),
    ),
  );
}

function terminalHubEnvelope(source: ExitDecisionSource): ExitDecision {
  return Object.freeze({
    kind: 'exit',
    source,
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: Object.freeze({ kind: 'none' }),
      batchState: null,
      targets: Object.freeze([]),
    }),
    selection: Object.freeze({ kind: 'unresolved' }),
  });
}

function replaceWithHubDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ReplaceWithHubDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'hub') failCommand(command, 'unknown Hub decision');
  if (
    command.hub.routeKey !== command.decision.routeKey ||
    command.hub.biomeKey !== command.decision.biomeKey
  ) {
    failCommand(command, 'Hub address does not match the terminal decision biome');
  }
  if (command.hub.hubKey !== located.layout.progression.hubKey)
    failCommand(command, 'unknown Hub decision');
  if (command.decision.source.kind !== 'occurrence') {
    failCommand(command, 'Hub takeover requires an occurrence-owned terminal envelope');
  }
  if (topology.decisions.some((decision) => decision.kind === 'hub'))
    failCommand(command, 'Hub decision already exists');
  const source = Object.freeze({
    kind: 'occurrence' as const,
    occurrenceId: command.decision.source.occurrenceId,
  });
  const terminal = hubTerminalTakeoverForSource(catalog, located.layout, topology, source);
  if (terminal === undefined || terminal.hubKey !== command.hub.hubKey) {
    failCommand(command, 'Hub takeover is not declared at this terminal envelope');
  }
  const envelope = exitDecisionForSource(topology, command.decision.source);
  if (envelope === undefined || !isExactTerminalTakeoverEnvelope(envelope)) {
    failCommand(command, 'Hub takeover requires the exact empty terminal envelope');
  }
  const impact = describeExitDecisionRemovalImpact(topology, source);
  if (impact === undefined) throw new Error('terminal Hub envelope disappeared during replacement');
  return updateTopology(
    document,
    located,
    appendDecision(
      applyTopologyRemovalImpact(topology, impact),
      Object.freeze({
        kind: 'hub',
        hubKey: command.hub.hubKey,
        source,
        openTargets: Object.freeze([]),
        visitOrder: Object.freeze([]),
      }),
    ),
  );
}

function removeHubDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'RemoveHubDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    located.layout.progression.kind !== 'hub' ||
    command.hub.hubKey !== located.layout.progression.hubKey
  ) {
    failCommand(command, 'unknown Hub decision');
  }
  const hub = topology.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === command.hub.hubKey,
  );
  if (hub === undefined) return document;
  const terminal = hubTerminalTakeoverForSource(catalog, located.layout, topology, hub.source);
  if (terminal === undefined || terminal.hubKey !== hub.hubKey) {
    failCommand(command, 'Hub decision has no declared terminal source to restore');
  }
  const impact = describeHubDecisionRemovalImpact(topology, hub.hubKey);
  if (impact === undefined) throw new Error('Hub decision disappeared during removal');
  return updateTopology(
    document,
    located,
    appendDecision(applyTopologyRemovalImpact(topology, impact), terminalHubEnvelope(hub.source)),
  );
}

function updateHub(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    {
      readonly kind: 'OpenHubSlot' | 'CloseHubSlot' | 'ReplaceHubVisitOrder';
    }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'hub')
    failCommand(command, 'Hub commands require a Hub progression');
  const descriptor = located.layout.progression;
  const hub = topology.decisions.find(
    (decision): decision is HubDecision =>
      decision.kind === 'hub' && decision.hubKey === descriptor.hubKey,
  );
  if (hub === undefined) failCommand(command, 'Hub decision has not been created');
  if (command.kind === 'OpenHubSlot') {
    if (command.slot.hubKey !== descriptor.hubKey)
      failCommand(command, 'Hub address does not match this decision');
    const slot = descriptor.slots.find(
      (candidate) => candidate.slotKey === command.slot.hubSlotKey,
    );
    if (slot === undefined) failCommand(command, `unknown Hub slot ${command.slot.hubSlotKey}`);
    if (hub.openTargets.some((target) => target.hubSlotKey === slot.slotKey)) return document;
    if (hub.openTargets.length >= descriptor.openCount.max)
      failCommand(command, 'Hub already has its maximum open slots');
    for (const constraint of descriptor.openSlotConstraints) {
      if (
        constraint.kind === 'maxOpenFromSlots' &&
        constraint.slotKeys.includes(slot.slotKey) &&
        hub.openTargets.filter((target) => constraint.slotKeys.includes(target.hubSlotKey))
          .length >= constraint.max
      ) {
        failCommand(command, `Hub open-slot constraint excludes ${slot.slotKey}`);
      }
    }
    if (topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId))
      failCommand(command, `occurrence ${command.occurrenceId} already exists`);
    const room = requireRoom(catalog, slot.roomGameName, located.layout.biomeKey, command);
    const localGroup = requireEphyraSideRooms(room, room.gameName);
    const expectedLocalSlots = localGroup?.slots ?? [];
    const suppliedLocalSlotKeys = Object.keys(command.localOccurrenceIdsBySlot);
    if (
      suppliedLocalSlotKeys.length !== expectedLocalSlots.length ||
      suppliedLocalSlotKeys.some(
        (slotKey) => !expectedLocalSlots.some((candidate) => candidate.slotKey === slotKey),
      )
    ) {
      failCommand(command, 'local occurrence identities must match the declaration-fixed slots');
    }
    const createdIds = [command.occurrenceId, ...Object.values(command.localOccurrenceIdsBySlot)];
    if (new Set(createdIds).size !== createdIds.length) {
      failCommand(command, 'main and local occurrence identities must be distinct');
    }
    if (
      createdIds.some((occurrenceId) =>
        topology.occurrences.some((occurrence) => occurrence.occurrenceId === occurrenceId),
      )
    ) {
      failCommand(command, 'one or more supplied occurrence identities already exist');
    }
    const replacement: HubDecision = Object.freeze({
      ...hub,
      openTargets: Object.freeze([
        ...hub.openTargets,
        Object.freeze({ hubSlotKey: slot.slotKey, occurrenceId: command.occurrenceId }),
      ]),
    });
    let next = appendOccurrence(
      topology,
      defaultOccurrence(
        catalog,
        room,
        command.occurrenceId,
        'ordinary',
        false,
        undefined,
        located.loadout,
      ),
      command,
    );
    if (localGroup !== undefined) {
      const targetsBySlot: Record<
        string,
        { readonly occurrenceId: OccurrenceId; readonly generation: 'notGenerated' }
      > = {};
      for (const localSlot of localGroup.slots) {
        const localOccurrenceId = command.localOccurrenceIdsBySlot[localSlot.slotKey];
        if (localOccurrenceId === undefined) {
          failCommand(command, `missing local occurrence identity for ${localSlot.slotKey}`);
        }
        const localRoom = requireRoom(
          catalog,
          localSlot.roomGameName,
          located.layout.biomeKey,
          command,
        );
        next = appendOccurrence(
          next,
          defaultOccurrence(
            catalog,
            localRoom,
            localOccurrenceId,
            'ordinary',
            false,
            undefined,
            located.loadout,
          ),
          command,
        );
        targetsBySlot[localSlot.slotKey] = Object.freeze({
          occurrenceId: localOccurrenceId,
          generation: 'notGenerated',
        });
      }
      next = appendDecision(
        next,
        Object.freeze({
          kind: 'localVisit',
          sourceOccurrenceId: command.occurrenceId,
          groupKey: localGroup.key,
          targetsBySlot: Object.freeze(targetsBySlot),
          visitOrder: Object.freeze([]),
        }),
      );
    }
    return updateTopology(document, located, replaceDecision(next, replacement));
  }
  if (command.kind === 'CloseHubSlot') {
    if (command.slot.hubKey !== descriptor.hubKey)
      failCommand(command, 'Hub address does not match this decision');
    const target = hub.openTargets.find(
      (candidate) => candidate.hubSlotKey === command.slot.hubSlotKey,
    );
    if (target === undefined) return document;
    if (hub.visitOrder.includes(target.hubSlotKey))
      failCommand(command, 'remove Hub visits before closing a slot');
    const impact = describeHubSlotClosureImpact(
      topology,
      descriptor.hubKey,
      target.hubSlotKey,
      descriptor.openCount.min,
    );
    if (impact === undefined)
      failCommand(command, `Hub slot ${target.hubSlotKey} has no open target`);
    const replacement: HubDecision = Object.freeze({
      ...hub,
      openTargets: Object.freeze(hub.openTargets.filter((candidate) => candidate !== target)),
    });
    return updateTopology(
      document,
      located,
      replaceDecision(applyTopologyRemovalImpact(topology, impact), replacement),
    );
  }
  if (command.hub.hubKey !== descriptor.hubKey)
    failCommand(command, 'Hub address does not match this decision');
  if (
    !Array.isArray(command.hubSlotKeys) ||
    !command.hubSlotKeys.every((hubSlotKey) => typeof hubSlotKey === 'string')
  ) {
    failCommand(command, 'Hub visit order must contain slot keys');
  }
  const visits = [...command.hubSlotKeys];
  if (visits.some((hubSlotKey) => hubSlotKey.trim().length === 0)) {
    failCommand(command, 'Hub visit order must contain non-blank slot keys');
  }
  if (new Set(visits).size !== visits.length) failCommand(command, 'Hub visits must be distinct');
  if (
    visits.some((hubSlotKey) => !hub.openTargets.some((target) => target.hubSlotKey === hubSlotKey))
  ) {
    failCommand(command, 'Hub visits must reference open slots');
  }
  if (visits.length > descriptor.requiredVisits)
    failCommand(command, `Hub supports ${descriptor.requiredVisits} visits`);
  if (
    visits.length === hub.visitOrder.length &&
    visits.every((hubSlotKey, index) => hub.visitOrder[index] === hubSlotKey)
  ) {
    return document;
  }
  const withoutCompletedHandoff =
    hub.visitOrder.length === descriptor.requiredVisits && visits.length < descriptor.requiredVisits
      ? removeCompletedHubHandoff(topology, descriptor.hubKey)
      : topology;
  return updateTopology(
    document,
    located,
    replaceDecision(
      withoutCompletedHandoff,
      Object.freeze({ ...hub, visitOrder: Object.freeze(visits) }),
    ),
  );
}

function updateLocalVisit(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    TopologyCommand,
    { readonly kind: 'SetLocalVisitGeneration' | 'ReplaceLocalVisitOrder' }
  >,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const address = command.kind === 'SetLocalVisitGeneration' ? command.slot : command.order;
  const decision = localVisitDecisionForSource(
    topology,
    address.sourceOccurrenceId,
    address.groupKey,
  );
  if (decision === undefined) failCommand(command, 'local visit decision does not exist');
  const source = requireOccurrence(located.plan, decision.sourceOccurrenceId, command);
  const room = requireRoom(catalog, source.gameName, located.layout.biomeKey, command);
  const descriptor = requireEphyraSideRooms(room, room.gameName);
  if (descriptor?.key !== decision.groupKey) {
    failCommand(command, 'local visit decision does not match its source declaration');
  }
  if (command.kind === 'SetLocalVisitGeneration') {
    const slot = descriptor.slots.find((candidate) => candidate.slotKey === command.slot.slotKey);
    const target = decision.targetsBySlot[command.slot.slotKey];
    if (slot === undefined || target === undefined)
      failCommand(command, 'unknown local visit slot');
    if (
      command.generation === 'notGenerated' &&
      decision.visitOrder.includes(target.occurrenceId)
    ) {
      failCommand(command, 'remove the local occurrence from visit order before disabling it');
    }
    if (target.generation === command.generation) return document;
    return updateTopology(
      document,
      located,
      replaceDecision(
        topology,
        Object.freeze({
          ...decision,
          targetsBySlot: Object.freeze({
            ...decision.targetsBySlot,
            [command.slot.slotKey]: Object.freeze({
              ...target,
              generation: command.generation,
            }),
          }),
        }),
      ),
    );
  }
  if (new Set(command.occurrenceIds).size !== command.occurrenceIds.length) {
    failCommand(command, 'local visit order must contain distinct occurrences');
  }
  const targets = Object.values(decision.targetsBySlot);
  for (const occurrenceId of command.occurrenceIds) {
    const target = targets.find((candidate) => candidate.occurrenceId === occurrenceId);
    if (target === undefined) failCommand(command, `unknown local occurrence ${occurrenceId}`);
    if (target.generation !== 'generated') {
      failCommand(command, `${occurrenceId} must be generated before it can be entered`);
    }
  }
  if (
    command.occurrenceIds.length === decision.visitOrder.length &&
    command.occurrenceIds.every(
      (occurrenceId, index) => decision.visitOrder[index] === occurrenceId,
    )
  ) {
    return document;
  }
  return updateTopology(
    document,
    located,
    replaceDecision(
      topology,
      Object.freeze({ ...decision, visitOrder: Object.freeze([...command.occurrenceIds]) }),
    ),
  );
}

export function applyTopologyCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: TopologyCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateStart':
      return createStart(document, catalog, located, command);
    case 'CreateBatch':
      return createBatch(document, catalog, located, command);
    case 'InitializeExitDecision':
      return initializeExitDecision(document, catalog, located, command);
    case 'CreateTarget':
      return createTarget(document, catalog, located, command);
    case 'CreateTakeoverBatch':
    case 'ReplaceWithTakeoverBatch':
    case 'ReconcileTakeoverBatch':
      return replaceTakeoverBatch(document, catalog, located, command);
    case 'ReconcileBatchExitCapacity':
      return reconcileBatchExitCapacity(document, catalog, located, command);
    case 'ReplaceBatchRewardStore':
      return replaceBatchRewardStore(document, catalog, located, command);
    case 'ReplaceFieldsCageOutcome':
      return replaceFieldsCageOutcome(document, catalog, located, command);
    case 'SetExitSelection':
      return setExitSelection(document, catalog, located, command);
    case 'RemoveExitDecision':
      return removeExitDecision(document, located, command);
    case 'ReplaceWithHubDecision':
      return replaceWithHubDecision(document, catalog, located, command);
    case 'RemoveHubDecision':
      return removeHubDecision(document, catalog, located, command);
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'ReplaceHubVisitOrder':
      return updateHub(document, catalog, located, command);
    case 'SetLocalVisitGeneration':
    case 'ReplaceLocalVisitOrder':
      return updateLocalVisit(document, catalog, located, command);
    case 'ClearTopology':
      return clearTopology(document, located, command);
  }
}
