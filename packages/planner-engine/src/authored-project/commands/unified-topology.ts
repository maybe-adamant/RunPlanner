import type { Catalog, RoomDeclaration } from '../../catalog-schema';
import { createInitialBatchState } from '../batchState';
import {
  applyTopologyRemovalImpact,
  describeClearTopologyImpact,
  describeExitDecisionRemovalImpact,
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
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { createDefaultRoomState, type RoomOccurrenceRole } from '../roomState';
import { replaceBiomeStateField } from '../biomeState';
import { declaredPhysicalExitKeys, selectedOrdinaryBatchIndex } from '../topology';
import {
  failCommand,
  requireOccurrence,
  requireRoom,
  requireTopology,
  withBiome,
  type LocatedBiome,
} from './contract';
import { applyOccurrenceStateCommand } from './occurrence-state';
import type { ProjectCommand } from './types';

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
  command: ProjectCommand,
): readonly string[] {
  const topology = located.plan.topology;
  if (topology !== null) {
    const declared = declaredPhysicalExitKeys(catalog, located.layout, topology, source);
    if (declared !== undefined) return declared;
  }
  if (source.kind === 'hubDecision') {
    if (
      located.layout.progression.kind !== 'hub' ||
      source.decisionKey !== located.layout.progression.hubKey
    ) {
      failCommand(
        command,
        `${source.decisionKey} is not a Hub decision in ${located.layout.biomeKey}`,
      );
    }
    return [located.layout.progression.completedExit.exitKey];
  }
  const occurrence = requireOccurrence(located.plan, source.occurrenceId, command);
  const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
  return room.exits.map((exit) => `exit${exit.index}`);
}

function sourceRoom(
  catalog: Catalog,
  located: LocatedBiome,
  source: ExitDecisionSourceAddress,
  command: ProjectCommand,
): RoomDeclaration | undefined {
  if (source.kind === 'hubDecision') return undefined;
  return requireRoom(
    catalog,
    requireOccurrence(located.plan, source.occurrenceId, command).gameName,
    located.layout.biomeKey,
    command,
  );
}

function initialRewardStore(
  located: LocatedBiome,
  sourceRoom: RoomDeclaration | undefined,
): BatchRewardStoreState {
  const policy =
    located.layout.progression.kind === 'generated' && sourceRoom !== undefined
      ? (located.layout.progression.rewardStoreOverrides.find(
          (override) => override.sourceEncounterProfileKey === sourceRoom.encounterProfileKey,
        )?.policy ?? located.layout.progression.rewardStorePolicy)
      : { kind: 'none' as const };
  if (policy.kind === 'authoredBaseStore')
    return Object.freeze({ kind: 'authoredBaseStore', baseRewardStoreKey: null });
  return Object.freeze({ kind: policy.kind });
}

function findExitDecision(
  topology: BiomeTopology,
  source: ExitDecisionSourceAddress,
): ExitDecision | undefined {
  return topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' && sourceEquals(decision.source, source),
  );
}

function replaceDecision(
  topology: BiomeTopology,
  replacement: ExitDecision | HubDecision,
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
        : decision,
  );
  return Object.freeze({ ...topology, decisions: Object.freeze(decisions) });
}

function appendDecision(
  topology: BiomeTopology,
  decision: ExitDecision | HubDecision,
): BiomeTopology {
  return Object.freeze({
    ...topology,
    decisions: Object.freeze([...topology.decisions, decision]),
  });
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
  resolvedStoreKey?: string,
): RoomOccurrence {
  return Object.freeze({
    occurrenceId,
    gameName: room.gameName,
    state: createDefaultRoomState(catalog, room, {
      role,
      entryActive,
      ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    }),
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

function selectedExitKey(
  selection: ExitSelection,
  targets: readonly ExitTargetReference[],
): string | undefined {
  if (selection.kind === 'derived') return targets[0]?.exitKey;
  return selection.kind === 'normal' ? selection.exitKey : undefined;
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
  command: ProjectCommand,
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
  command: ProjectCommand,
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
  command: Extract<ProjectCommand, { readonly kind: 'CreateStart' }>,
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
  const occurrence = defaultOccurrence(catalog, room, command.occurrenceId, 'ordinary', true);
  return withBiome(document, located, {
    ...located.plan,
    topology: Object.freeze({
      startOccurrenceId: command.occurrenceId,
      occurrences: Object.freeze([occurrence]),
      decisions: Object.freeze([]),
    }),
  });
}

function createLinkedExit(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'CreateLinkedExit' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    located.layout.progression.kind !== 'hub' ||
    command.decision.source.kind !== 'occurrence' ||
    command.decision.source.occurrenceId !== topology.startOccurrenceId
  ) {
    failCommand(command, 'only the fixed Hub start owns the declared linked PreHub exit');
  }
  if (findExitDecision(topology, command.decision.source) !== undefined)
    failCommand(command, 'exit decision already exists');
  const room = requireRoom(
    catalog,
    located.layout.progression.linkedExit.roomGameName,
    located.layout.biomeKey,
    command,
  );
  const occurrence = defaultOccurrence(catalog, room, command.occurrenceId, 'ordinary', true);
  const next = appendDecision(
    appendOccurrence(topology, occurrence, command),
    Object.freeze({
      kind: 'exit',
      source: sourceFromAddress(command.decision.source),
      normal: Object.freeze({
        kind: 'linked',
        exitKey: located.layout.progression.linkedExit.exitKey,
        occurrenceId: command.occurrenceId,
      }),
      selection: Object.freeze({ kind: 'derived' }),
    }),
  );
  return updateTopology(document, located, next);
}

function createBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'CreateBatch' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'generated') {
    failCommand(command, 'ordinary normal-door batches require generated progression');
  }
  if (command.decision.source.kind === 'hubDecision') {
    failCommand(command, 'the completed Hub emits its declaration-fixed takeover batch');
  }
  if (findExitDecision(topology, command.decision.source) !== undefined)
    failCommand(command, 'exit decision already exists');
  const room = sourceRoom(catalog, located, command.decision.source, command);
  if (room?.kind === 'Preboss')
    failCommand(command, 'a selected Preboss closes editable traversal');
  if (
    located.layout.progression.kind === 'generated' &&
    topology.decisions.filter(
      (decision) => decision.kind === 'exit' && decision.normal.kind === 'batch',
    ).length >= located.layout.progression.bounds.maxBatches
  ) {
    failCommand(command, 'generated progression has reached its declaration-owned batch bound');
  }
  const batchState =
    located.layout.progression.kind === 'generated'
      ? createInitialBatchState(located.layout.progression.batchPolicy)
      : null;
  const decision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: sourceFromAddress(command.decision.source),
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: initialRewardStore(located, room),
      batchState,
      targets: Object.freeze([]),
    }),
    selection: Object.freeze({ kind: 'unresolved' }),
  });
  return updateTopology(document, located, appendDecision(topology, decision));
}

function createTarget(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'CreateTarget' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (located.layout.progression.kind !== 'generated') {
    failCommand(command, 'ordinary normal-door targets require generated progression');
  }
  if (command.target.source.kind === 'hubDecision') {
    failCommand(command, 'the completed Hub emits its declaration-fixed takeover batch');
  }
  const decision = findExitDecision(topology, command.target.source);
  if (decision?.normal.kind !== 'batch') failCommand(command, 'normal-door batch does not exist');
  const allowed = exitKeysForSource(catalog, located, command.target.source, command);
  if (!allowed.includes(command.target.exitKey))
    failCommand(command, `${command.target.exitKey} is not declared by this source`);
  if (decision.normal.targets.some((target) => target.exitKey === command.target.exitKey))
    failCommand(command, `${command.target.exitKey} already has a target`);
  if (topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId))
    failCommand(command, `occurrence ${command.occurrenceId} already exists`);
  const room = requireRoom(catalog, command.gameName, located.layout.biomeKey, command);
  if (room.kind === 'Intro' || room.kind === 'Opening' || room.kind === 'PreHub') {
    failCommand(command, `${room.gameName} is not an ordinary normal-door target`);
  }
  if (room.prebossBatchPolicy?.kind === 'takeOverNormalDoors')
    failCommand(command, 'takeover Preboss targets require an atomic takeover batch command');
  if (
    room.prebossBatchPolicy?.kind === 'retainNormalPeers' &&
    decision.normal.targets.some(
      (target) =>
        topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
          ?.gameName === room.gameName,
    )
  ) {
    failCommand(command, `${room.gameName} may appear only once in one normal-door batch`);
  }
  if (
    located.layout.progression.kind === 'generated' &&
    topology.decisions.reduce(
      (count, candidate) =>
        candidate.kind === 'exit' && candidate.normal.kind === 'batch'
          ? count + candidate.normal.targets.length
          : count,
      0,
    ) >= located.layout.progression.bounds.maxTargets
  ) {
    failCommand(command, 'generated progression has reached its declaration-owned target bound');
  }
  if (
    located.layout.progression.kind === 'generated' &&
    located.layout.progression.progressionPolicy.kind === 'staged'
  ) {
    const batchIndex =
      decision.source.kind === 'occurrence'
        ? selectedOrdinaryBatchIndex(topology, decision.source.occurrenceId)
        : undefined;
    const stage =
      batchIndex === undefined
        ? undefined
        : located.layout.progression.progressionPolicy.stages[batchIndex];
    if (stage === undefined || !stage.roomGameNames.includes(room.gameName)) {
      failCommand(command, `${room.gameName} is not available in stage ${stage?.key ?? '?'}`);
    }
  }
  if (
    decision.normal.rewardStore.kind === 'authoredBaseStore' &&
    decision.normal.rewardStore.baseRewardStoreKey === null
  ) {
    failCommand(command, 'select the batch reward store before authoring targets');
  }
  if (
    located.layout.progression.kind === 'generated' &&
    located.layout.progression.batchPolicy.kind === 'fields' &&
    decision.normal.batchState === null
  ) {
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
    targets.length === 1
      ? Object.freeze({ kind: 'derived' })
      : decision.selection.kind === 'normal'
        ? decision.selection
        : Object.freeze({ kind: 'unresolved' });
  const previouslySelectedExitKey = selectedExitKey(decision.selection, decision.normal.targets);
  const nextSelectedExitKey = selectedExitKey(selection, targets);
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
        );
  });
  const next = replaceDecision(
    Object.freeze({ ...withTarget, occurrences: Object.freeze(occurrences) }),
    Object.freeze({
      ...decision,
      normal: Object.freeze({ ...decision.normal, targets }),
      selection,
    }),
  );
  return updateTopology(document, located, next);
}

function replaceTakeoverBatch(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    ProjectCommand,
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
    if (
      hub === undefined ||
      hub.openTargets.length < located.layout.progression.openCount.min ||
      hub.visitOrder.length !== located.layout.progression.requiredVisits
    ) {
      failCommand(command, 'complete the required Hub visits before creating its Preboss batch');
    }
  }
  const existing = findExitDecision(topology, command.decision.source);
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
    ids.length === 1
      ? Object.freeze({ kind: 'derived' })
      : existing?.selection.kind === 'normal' && exitKeys.includes(existing.selection.exitKey)
        ? existing.selection
        : Object.freeze({ kind: 'unresolved' });
  const replacements: RoomOccurrence[] = [];
  const targets: ExitTargetReference[] = [];
  for (const [index, exitKey] of exitKeys.entries()) {
    const suppliedOccurrenceId = ids[index] as OccurrenceId;
    const oldTarget = oldTargetByExitKey.get(exitKey);
    if (oldTarget !== undefined && suppliedOccurrenceId !== oldTarget.occurrenceId) {
      failCommand(
        command,
        `takeover repair must retain ${exitKey} occurrence ${oldTarget.occurrenceId}`,
      );
    }
    const occurrenceId = oldTarget?.occurrenceId ?? suppliedOccurrenceId;
    const role = expectedPrebossRole(room, index, command);
    const old = oldTarget === undefined ? undefined : occurrencesById.get(oldTarget.occurrenceId);
    if (oldTarget === undefined && occurrencesById.has(occurrenceId))
      failCommand(command, `occurrence ${occurrenceId} is already structurally owned`);
    const entryActive =
      selection.kind === 'derived' ||
      (selection.kind === 'normal' && selection.exitKey === exitKey);
    replacements.push(
      old !== undefined && compatiblePrebossOccurrence(old, room, role, entryActive)
        ? old
        : defaultOccurrence(
            catalog,
            room,
            occurrenceId,
            role,
            entryActive,
            role === 'prebossFreeReward'
              ? prebossFreeRewardStore(room, sourceIncomingStore(topology, command.decision.source))
              : undefined,
          ),
    );
    targets.push(Object.freeze({ exitKey, occurrenceId }));
  }
  const sourceRoomValue = sourceRoom(catalog, located, command.decision.source, command);
  const decision: ExitDecision = Object.freeze({
    kind: 'exit',
    source: sourceFromAddress(command.decision.source),
    normal: Object.freeze({
      kind: 'batch',
      rewardStore: initialRewardStore(located, sourceRoomValue),
      batchState: null,
      targets: Object.freeze(targets),
    }),
    selection,
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
  command: Extract<ProjectCommand, { readonly kind: 'SetExitSelection' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = findExitDecision(topology, command.selection.source);
  if (decision === undefined || decision.normal.kind !== 'batch')
    failCommand(command, 'normal-door batch does not exist');
  const batch = decision.normal;
  const keys = batch.targets.map((target) => target.exitKey);
  if (command.value.kind === 'derived' && keys.length !== 1)
    failCommand(command, 'derived selection requires one normal exit');
  if (command.value.kind === 'unresolved' && keys.length === 1)
    failCommand(command, 'width-one selection is declaration-derived');
  if (command.value.kind === 'normal' && keys.length === 1)
    failCommand(command, 'width-one selection is declaration-derived');
  if (command.value.kind === 'normal' && !keys.includes(command.value.exitKey))
    failCommand(command, `${command.value.exitKey} is not a target exit`);
  const selectedExitKey =
    command.value.kind === 'derived'
      ? batch.targets[0]?.exitKey
      : command.value.kind === 'normal'
        ? command.value.exitKey
        : undefined;
  const previouslySelectedExitKey =
    decision.selection.kind === 'derived'
      ? batch.targets[0]?.exitKey
      : decision.selection.kind === 'normal'
        ? decision.selection.exitKey
        : undefined;
  if (previouslySelectedExitKey !== selectedExitKey) {
    const previousTarget = batch.targets.find(
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
  const occurrences = topology.occurrences.map((occurrence) => {
    const targetIndex = batch.targets.findIndex(
      (target) => target.occurrenceId === occurrence.occurrenceId,
    );
    if (targetIndex < 0) return occurrence;
    const room = requireRoom(catalog, occurrence.gameName, located.layout.biomeKey, command);
    if (room.kind !== 'Preboss' && room.kind !== 'Shop') return occurrence;
    const role: RoomOccurrenceRole =
      room.kind === 'Preboss' && room.prebossBatchPolicy?.kind === 'takeOverNormalDoors'
        ? expectedPrebossRole(room, targetIndex, command)
        : room.kind === 'Preboss'
          ? 'prebossShop'
          : 'ordinary';
    if (role !== 'prebossShop' && room.kind !== 'Shop') return occurrence;
    const entryActive = batch.targets[targetIndex]?.exitKey === selectedExitKey;
    const hasInventory = occurrence.state.kind === 'shop' && occurrence.state.shop !== undefined;
    if (hasInventory === entryActive) return occurrence;
    return defaultOccurrence(catalog, room, occurrence.occurrenceId, role, entryActive);
  });
  return updateTopology(
    document,
    located,
    replaceDecision(
      Object.freeze({ ...topology, occurrences: Object.freeze(occurrences) }),
      Object.freeze({ ...decision, selection: command.value }),
    ),
  );
}

function replaceBatchRewardStore(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'ReplaceBatchRewardStore' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = findExitDecision(topology, command.rewardStore.source);
  if (
    decision?.normal.kind !== 'batch' ||
    decision.normal.rewardStore.kind !== 'authoredBaseStore'
  ) {
    failCommand(command, 'normal-door batch does not expose an authored base reward store');
  }
  const source = sourceRoom(catalog, located, command.rewardStore.source, command);
  const policy =
    located.layout.progression.kind === 'generated' && source !== undefined
      ? (located.layout.progression.rewardStoreOverrides.find(
          (override) => override.sourceEncounterProfileKey === source.encounterProfileKey,
        )?.policy ?? located.layout.progression.rewardStorePolicy)
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

function removeExitDecision(
  document: ProjectDocument,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'RemoveExitDecision' }>,
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
  command: Extract<ProjectCommand, { readonly kind: 'ClearTopology' }>,
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
  command: Extract<ProjectCommand, { readonly kind: 'ReconcileBatchExitCapacity' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  const decision = findExitDecision(topology, command.decision.source);
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
  if (retained.length === 1) {
    selection = Object.freeze({ kind: 'derived' });
  } else if (
    existingSelection.kind === 'normal' &&
    retained.some((target) => target.exitKey === existingSelection.exitKey)
  ) {
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

function createHubDecision(
  document: ProjectDocument,
  located: LocatedBiome,
  command: Extract<ProjectCommand, { readonly kind: 'CreateHubDecision' }>,
): ProjectDocument {
  const topology = requireTopology(located.plan, command);
  if (
    located.layout.progression.kind !== 'hub' ||
    command.hub.hubKey !== located.layout.progression.hubKey
  )
    failCommand(command, 'unknown Hub decision');
  if (topology.decisions.some((decision) => decision.kind === 'hub'))
    failCommand(command, 'Hub decision already exists');
  const linked = topology.decisions.find(
    (decision): decision is ExitDecision =>
      decision.kind === 'exit' &&
      decision.source.kind === 'occurrence' &&
      decision.source.occurrenceId === topology.startOccurrenceId &&
      decision.normal.kind === 'linked',
  );
  if (linked === undefined)
    failCommand(command, 'Hub decision requires the selected linked PreHub exit');
  return updateTopology(
    document,
    located,
    appendDecision(
      topology,
      Object.freeze({
        kind: 'hub',
        hubKey: command.hub.hubKey,
        openTargets: Object.freeze([]),
        visitOrder: Object.freeze([]),
      }),
    ),
  );
}

function updateHub(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: Extract<
    ProjectCommand,
    {
      readonly kind:
        | 'OpenHubSlot'
        | 'CloseHubSlot'
        | 'AppendHubVisit'
        | 'ReplaceHubVisit'
        | 'RemoveHubVisitsFrom';
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
    const replacement: HubDecision = Object.freeze({
      ...hub,
      openTargets: Object.freeze([
        ...hub.openTargets,
        Object.freeze({ hubSlotKey: slot.slotKey, occurrenceId: command.occurrenceId }),
      ]),
    });
    return updateTopology(
      document,
      located,
      replaceDecision(
        appendOccurrence(
          topology,
          defaultOccurrence(catalog, room, command.occurrenceId, 'ordinary', false),
          command,
        ),
        replacement,
      ),
    );
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
  if (command.visit.hubKey !== descriptor.hubKey)
    failCommand(command, 'Hub address does not match this decision');
  const visits = [...hub.visitOrder];
  if (command.kind === 'RemoveHubVisitsFrom') {
    if (command.visit.visitIndex > visits.length) return document;
    visits.splice(command.visit.visitIndex - 1);
  } else {
    if (!hub.openTargets.some((target) => target.hubSlotKey === command.hubSlotKey))
      failCommand(command, `${command.hubSlotKey} is not open`);
    if (command.kind === 'AppendHubVisit') {
      if (command.visit.visitIndex !== visits.length + 1)
        failCommand(command, 'Hub visits append in order');
      visits.push(command.hubSlotKey);
    } else {
      if (command.visit.visitIndex > visits.length)
        failCommand(command, 'Hub visit does not exist');
      visits[command.visit.visitIndex - 1] = command.hubSlotKey;
    }
    if (new Set(visits).size !== visits.length) failCommand(command, 'Hub visits must be distinct');
  }
  if (visits.length > descriptor.requiredVisits)
    failCommand(command, `Hub supports ${descriptor.requiredVisits} visits`);
  const withoutCompletedHandoff =
    command.kind === 'RemoveHubVisitsFrom' && visits.length < descriptor.requiredVisits
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

export function applyUnifiedTopologyCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  command: ProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateStart':
      return createStart(document, catalog, located, command);
    case 'CreateLinkedExit':
      return createLinkedExit(document, catalog, located, command);
    case 'CreateBatch':
      return createBatch(document, catalog, located, command);
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
    case 'SetExitSelection':
      return setExitSelection(document, catalog, located, command);
    case 'RemoveExitDecision':
      return removeExitDecision(document, located, command);
    case 'CreateHubDecision':
      return createHubDecision(document, located, command);
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'AppendHubVisit':
    case 'ReplaceHubVisit':
    case 'RemoveHubVisitsFrom':
      return updateHub(document, catalog, located, command);
    case 'ReplaceBiomeField':
      return withBiome(document, located, {
        ...located.plan,
        state: replaceBiomeStateField(
          located.plan.state,
          located.layout,
          command.field.fieldKey,
          command.value,
          `${command.kind}.value`,
        ),
      });
    case 'ClearTopology':
      return clearTopology(document, located, command);
    default: {
      const stateResult = applyOccurrenceStateCommand(document, catalog, located, command);
      return (
        stateResult ??
        failCommand(
          command,
          `${command.kind} has not yet been migrated to common topology commands`,
        )
      );
    }
  }
}
