import type { Catalog } from '../../../catalog-schema';
import { createInitialExitDecision } from '../../batchState';
import {
  applyTopologyRemovalImpact,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
  describeHubDecisionRemovalImpact,
  describeTopologyRemovalImpact,
} from '../../topology/impact';
import type {
  BiomeTopology,
  ExitDecision,
  ExitSelection,
  ExitTargetReference,
  HubDecision,
  OccurrenceId,
  ProjectDocument,
} from '../../model';
import {
  additionalExitsForDecision,
  exitDecisionForSource,
  hubTerminalTakeoverForSource,
  isHostRouteDetourRoom,
  normalDecisionProgressionForLayout,
  ordinaryBatchCreationEligibility,
  ordinaryTargetAuthoringEligibility,
  selectedExitContinuation,
  selectedExitKey,
} from '../../topology/query';
import { fieldsDefaultActiveCageCount } from '../../fields';
import { sameExitDecisionSource } from '../../topology/source-identity';
import type { RoomOccurrenceRole } from '../../room-state/declaration';
import {
  failCommand,
  locateBiome,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from '../contract';
import type { TopologyCommand } from '../types';
import { reconcileNormalTargetEntryStates } from '../selection-state';
import { reconcileExitDecisionToDeclaredCapacity } from '../topology-reconciliation';
import {
  sourceFromAddress,
  exitKeysForSource,
  sourceRoom,
  replaceDecision,
  appendDecision,
  resolvedStoreKey,
  appendOccurrence,
  expectedPrebossRole,
  updateTopology,
} from './construction';
import {
  createDefaultStartTopology,
  createStartTopology,
  defaultOccurrence,
} from '../../topology/construction';
import { reconcileCompletionChain } from './takeover';
import { replaceWithHubDecision } from './hub';
import { resolveEntryDeclaration } from '../../room-state/entry-resolution';

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

export function createStart(
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
  const room = resolveEntryDeclaration(
    requireRoom(catalog, gameName, located.layout.biomeKey, command),
    located.routePosition,
  );
  return withBiome(document, located, {
    ...located.plan,
    topology: createStartTopology(
      catalog,
      room,
      command.occurrenceId,
      located.loadout,
      located.routePosition,
    ),
  });
}

export function createBatch(
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
    (room === undefined || !isHostRouteDetourRoom(room)) &&
    hubTerminalTakeoverForSource(
      catalog,
      located.layout,
      topology,
      sourceFromAddress(command.decision.source),
    ) === undefined
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
export function initializeExitDecision(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'InitializeExitDecision' }>,
): ProjectDocument {
  if (
    command.edit.kind === 'target' &&
    (command.edit.target.routeKey !== command.decision.routeKey ||
      command.edit.target.biomeKey !== command.decision.biomeKey ||
      !sameExitDecisionSource(
        sourceFromAddress(command.decision.source),
        command.edit.target.source,
      ))
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

export function createTarget(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'CreateTarget' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const room = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  if (
    room.kind === 'Preboss' &&
    located.routePosition.completion.prebossRoomGameName !== room.gameName
  ) {
    failCommand(command, `${room.gameName} is not this route position's declared Preboss`);
  }
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
  const previouslySelectedExitKey = selectedExitKey(decision);
  const previousTarget = decision.normal.targets.find(
    (target) => target.exitKey === previouslySelectedExitKey,
  );
  const previousTargetOwnsDownstreamDecision =
    previousTarget !== undefined &&
    topology.decisions.some(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === previousTarget.occurrenceId,
    );
  const selection: ExitSelection =
    targets.length === 1 && additionalExitsForDecision(topology, decision).length === 0
      ? Object.freeze({ kind: 'derived' })
      : decision.selection.kind === 'normal' || decision.selection.kind === 'additional'
        ? decision.selection
        : decision.selection.kind === 'derived' &&
            previouslySelectedExitKey !== undefined &&
            previousTargetOwnsDownstreamDecision
          ? Object.freeze({ kind: 'normal', exitKey: previouslySelectedExitKey })
          : Object.freeze({ kind: 'unresolved' });
  const nextDecision: ExitDecision = Object.freeze({
    ...decision,
    normal: Object.freeze({ ...decision.normal, targets }),
    selection,
  });
  const nextSelectedExitKey = selectedExitKey(nextDecision);
  if (previouslySelectedExitKey !== nextSelectedExitKey) {
    if (previousTargetOwnsDownstreamDecision) {
      failCommand(command, 'remove the prior selected target’s downstream decision first');
    }
  }
  const batchRewardStoreKey = resolvedStoreKey(
    decision.normal.rewardStore,
    topology,
    decision.source,
  );
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
  const selectedTarget =
    nextSelectedExitKey === undefined
      ? undefined
      : targets.find((target) => target.exitKey === nextSelectedExitKey)?.occurrenceId;
  const prebossFor = (
    topologyValue: BiomeTopology,
    occurrenceId: OccurrenceId | undefined,
  ): OccurrenceId | undefined => {
    if (occurrenceId === undefined) return undefined;
    const occurrence = topologyValue.occurrences.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    return occurrence !== undefined && catalog.rooms.byKey[occurrence.gameName]?.kind === 'Preboss'
      ? occurrenceId
      : undefined;
  };
  const previousPreboss = prebossFor(topology, previousTarget?.occurrenceId);
  const nextPreboss = prebossFor(next, selectedTarget);
  return updateTopology(
    document,
    located,
    reconcileCompletionChain(catalog, located, next, previousPreboss, nextPreboss, command),
  );
}

function hasCompatibleRewardStore(
  located: LocatedBiome,
  sourceRoomValue: ReturnType<typeof sourceRoom>,
  decision: ExitDecision,
): boolean {
  const progression = normalDecisionProgressionForLayout(located.layout);
  const sourceRoomTemplateKey =
    sourceRoomValue?.mode.kind === 'authored' ? sourceRoomValue.mode.templateKey : undefined;
  const policy =
    progression !== undefined && sourceRoomTemplateKey !== undefined
      ? (progression.rewardStoreOverrides.find(
          (override) => override.sourceRoomTemplateKey === sourceRoomTemplateKey,
        )?.policy ?? progression.rewardStorePolicy)
      : undefined;
  if (policy === undefined || decision.normal.rewardStore.kind !== policy.kind) return false;
  if (policy.kind !== 'authoredBaseStore') return true;
  const store = decision.normal.rewardStore;
  if (store.kind !== 'authoredBaseStore') return false;
  return store.baseRewardStoreKey === null || policy.storeKeys.includes(store.baseRewardStoreKey);
}

function hasCompleteTakeoverShapeForSource(
  catalog: Catalog,
  located: LocatedBiome,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId,
  decision: ExitDecision,
  command: Extract<TopologyCommand, { readonly kind: 'SetExitSelection' }>,
): boolean {
  const isTakeover = decision.normal.targets.some((target) => {
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    return (
      occurrence !== undefined &&
      catalog.rooms.byKey[occurrence.gameName]?.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
    );
  });
  if (!isTakeover) return true;
  const exitKeys = exitKeysForSource(
    catalog,
    located,
    { kind: 'occurrence', occurrenceId },
    command,
  );
  return exitKeys.every((exitKey) =>
    decision.normal.targets.some((target) => target.exitKey === exitKey),
  );
}

function selectedPrebossFromContinuation(
  catalog: Catalog,
  topology: BiomeTopology,
  occurrenceId: OccurrenceId | undefined,
): OccurrenceId | undefined {
  let currentOccurrenceId = occurrenceId;
  const visited = new Set<OccurrenceId>();
  while (currentOccurrenceId !== undefined && !visited.has(currentOccurrenceId)) {
    visited.add(currentOccurrenceId);
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === currentOccurrenceId,
    );
    if (occurrence === undefined) return undefined;
    if (catalog.rooms.byKey[occurrence.gameName]?.kind === 'Preboss') return currentOccurrenceId;
    const decision = exitDecisionForSource(topology, {
      kind: 'occurrence',
      occurrenceId: currentOccurrenceId,
    });
    const continuation =
      decision === undefined
        ? undefined
        : selectedExitContinuation(decision, additionalExitsForDecision(topology, decision));
    currentOccurrenceId =
      continuation?.kind === 'normal'
        ? continuation.target.occurrenceId
        : continuation?.kind === 'additional'
          ? continuation.exit.occurrenceId
          : undefined;
  }
  return undefined;
}

function rebaseSelectedContinuationDecision(
  topology: BiomeTopology,
  catalog: Catalog,
  located: LocatedBiome,
  previousOccurrenceId: OccurrenceId | undefined,
  nextOccurrenceId: OccurrenceId | undefined,
  command: Extract<TopologyCommand, { readonly kind: 'SetExitSelection' }>,
): BiomeTopology {
  if (previousOccurrenceId === undefined || previousOccurrenceId === nextOccurrenceId)
    return topology;

  const previousOccurrence = topology.occurrences.find(
    (occurrence) => occurrence.occurrenceId === previousOccurrenceId,
  );
  if (previousOccurrence === undefined) {
    failCommand(command, 'previous selected occurrence is missing');
  }
  const withoutPreviousExtras =
    previousOccurrence.additionalExits.length === 0
      ? topology
      : applyTopologyRemovalImpact(
          topology,
          describeTopologyRemovalImpact(
            topology,
            new Set(previousOccurrence.additionalExits.map((exit) => exit.occurrenceId)),
          ),
        );

  const outgoing = topology.decisions.find(
    (candidate): candidate is ExitDecision =>
      candidate.kind === 'exit' &&
      candidate.source.kind === 'occurrence' &&
      candidate.source.occurrenceId === previousOccurrenceId,
  );
  const hub = topology.decisions.find(
    (candidate): candidate is HubDecision =>
      candidate.kind === 'hub' && candidate.source.occurrenceId === previousOccurrenceId,
  );
  if (nextOccurrenceId === undefined) {
    if (outgoing !== undefined) {
      const impact = describeExitDecisionRemovalImpact(withoutPreviousExtras, outgoing.source);
      return impact === undefined
        ? withoutPreviousExtras
        : applyTopologyRemovalImpact(withoutPreviousExtras, impact);
    }
    if (hub !== undefined) {
      const impact = describeHubDecisionRemovalImpact(withoutPreviousExtras, hub.hubKey);
      return impact === undefined
        ? withoutPreviousExtras
        : applyTopologyRemovalImpact(withoutPreviousExtras, impact);
    }
    return withoutPreviousExtras;
  }

  const nextRoom = sourceRoom(
    catalog,
    located,
    { kind: 'occurrence', occurrenceId: nextOccurrenceId },
    command,
  );
  const targetAlreadyOwnsDecision = withoutPreviousExtras.decisions.some(
    (candidate) =>
      (candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === nextOccurrenceId) ||
      (candidate.kind === 'hub' && candidate.source.occurrenceId === nextOccurrenceId),
  );
  const nextIsFixedParticipant = withoutPreviousExtras.fixedRoomLinks.some(
    (link) =>
      link.sourceOccurrenceId === nextOccurrenceId || link.targetOccurrenceId === nextOccurrenceId,
  );
  if (targetAlreadyOwnsDecision || nextIsFixedParticipant) {
    failCommand(command, 'cannot rebase the prior selected continuation onto this target');
  }

  if (hub !== undefined) {
    const terminal = hubTerminalTakeoverForSource(catalog, located.layout, withoutPreviousExtras, {
      kind: 'occurrence',
      occurrenceId: nextOccurrenceId,
    });
    if (terminal === undefined || terminal.hubKey !== hub.hubKey) {
      const impact = describeHubDecisionRemovalImpact(withoutPreviousExtras, hub.hubKey);
      return impact === undefined
        ? withoutPreviousExtras
        : applyTopologyRemovalImpact(withoutPreviousExtras, impact);
    }
    const reanchoredHub = Object.freeze({
      ...hub,
      source: Object.freeze({ kind: 'occurrence' as const, occurrenceId: nextOccurrenceId }),
    });
    return Object.freeze({
      ...withoutPreviousExtras,
      decisions: Object.freeze(
        withoutPreviousExtras.decisions.map((candidate) =>
          candidate === hub ? reanchoredHub : candidate,
        ),
      ),
    });
  }

  if (outgoing === undefined) return withoutPreviousExtras;
  const downstreamRoots = new Set([
    ...outgoing.normal.targets.map((target) => target.occurrenceId),
  ]);
  const wouldCycle = describeTopologyRemovalImpact(
    withoutPreviousExtras,
    downstreamRoots,
  ).removedOccurrenceIds.includes(nextOccurrenceId);
  if (wouldCycle) {
    failCommand(command, 'cannot rebase the prior selected continuation onto this target');
  }
  if (nextRoom?.kind === 'Preboss') {
    const impact = describeExitDecisionRemovalImpact(withoutPreviousExtras, outgoing.source);
    return impact === undefined
      ? withoutPreviousExtras
      : applyTopologyRemovalImpact(withoutPreviousExtras, impact);
  }
  if (
    !hasCompatibleRewardStore(located, nextRoom, outgoing) ||
    !hasCompleteTakeoverShapeForSource(
      catalog,
      located,
      withoutPreviousExtras,
      nextOccurrenceId,
      outgoing,
      command,
    )
  ) {
    const impact = describeExitDecisionRemovalImpact(withoutPreviousExtras, outgoing.source);
    return impact === undefined
      ? withoutPreviousExtras
      : applyTopologyRemovalImpact(withoutPreviousExtras, impact);
  }
  const normalizedOutgoing: ExitDecision = Object.freeze({
    ...outgoing,
    selection:
      outgoing.selection.kind === 'additional'
        ? outgoing.normal.targets.length === 1
          ? Object.freeze({ kind: 'derived' })
          : Object.freeze({ kind: 'unresolved' })
        : outgoing.selection,
  });
  const reanchored = Object.freeze({
    ...normalizedOutgoing,
    source: Object.freeze({
      kind: 'occurrence' as const,
      occurrenceId: nextOccurrenceId,
    }),
  });
  const withReanchoredDecision = Object.freeze({
    ...withoutPreviousExtras,
    decisions: Object.freeze(
      withoutPreviousExtras.decisions.map((candidate) =>
        candidate === outgoing ? reanchored : candidate,
      ),
    ),
  });
  return reconcileExitDecisionToDeclaredCapacity(
    catalog,
    located,
    withReanchoredDecision,
    reanchored,
    command,
  );
}

export function setExitSelection(
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
  const selectionTopology = rebaseSelectedContinuationDecision(
    replaceDecision(topology, nextDecision),
    catalog,
    located,
    previousSelectedOccurrenceId,
    nextSelectedOccurrenceId,
    command,
  );
  const nextSelectedExitKey = selectedExitKey(nextDecision);
  const withSelectionState = reconcileNormalTargetEntryStates(
    catalog,
    located,
    selectionTopology,
    nextDecision,
    nextSelectedExitKey,
    command,
  );
  const selectedTopology = replaceDecision(withSelectionState, nextDecision);
  const previousPreboss = selectedPrebossFromContinuation(
    catalog,
    topology,
    previousSelectedOccurrenceId,
  );
  const nextPreboss = selectedPrebossFromContinuation(
    catalog,
    selectedTopology,
    nextSelectedOccurrenceId,
  );
  return updateTopology(
    document,
    located,
    reconcileCompletionChain(
      catalog,
      located,
      selectedTopology,
      previousPreboss,
      nextPreboss,
      command,
    ),
  );
}

export function replaceBatchRewardStore(
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

export function replaceFieldsCageOutcome(
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

export function removeExitDecision(
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

export function clearTopology(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<TopologyCommand, { readonly kind: 'ClearTopology' }>,
): ProjectDocument {
  const topology = located.plan.topology;
  if (topology !== null) {
    const cleared = applyTopologyRemovalImpact(topology, describeClearTopologyImpact(topology));
    if (cleared.occurrences.length !== 0 || cleared.decisions.length !== 0) {
      failCommand(command, 'ClearTopology impact must remove every persisted topology member');
    }
  }
  const replacement = createDefaultStartTopology(
    catalog,
    located.layout,
    located.routePosition,
    located.loadout,
  );
  if (topology === null && replacement === null) return document;
  return withBiome(document, located, { ...located.plan, topology: replacement });
}

export function reconcileBatchExitCapacity(
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
  return updateTopology(
    document,
    located,
    reconcileExitDecisionToDeclaredCapacity(catalog, located, topology, decision, command),
  );
}
