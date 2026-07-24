import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../../catalog-schema';
import { createInitialBatchState } from '../batchState';
import type {
  AuthoredBatchState,
  BatchRewardStoreState,
  LinearBatchContinuation,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from '../model';
import { createDefaultRoomState, type RoomOccurrenceRole } from '../roomState';
import {
  nextStagedBatchIndex,
  stagedBatchIndex,
  stagedProgressionStages,
  stagedRoomIsAvailable,
} from '../stagedProgression';

import {
  failCommand,
  generatedExitIndexes,
  hasGeneratedExit,
  requireOccurrence,
  requireRoom,
  requireTopology,
  roomStateContext,
  withBiome,
  type LocatedBiome,
} from './contract';
import type { LinearTopologyProjectCommand, ProjectCommand } from './types';
export function authoredBaseStorePolicy(layout: LinearBiomeLayout) {
  const policy = layout.continuation.rewardStorePolicy;
  if (policy.kind !== 'authoredBaseStore') {
    throw new Error(`${layout.biomeKey} does not author a generated base store`);
  }
  return policy;
}

function sourceRewardStorePolicy(layout: LinearBiomeLayout, sourceRoom: RoomDeclaration) {
  return (
    layout.continuation.rewardStoreOverrides.find(
      (override) => override.sourceEncounterProfileKey === sourceRoom.encounterProfileKey,
    )?.policy ?? layout.continuation.rewardStorePolicy
  );
}

function initialBatchRewardStore(
  layout: LinearBiomeLayout,
  sourceRoom: RoomDeclaration,
): BatchRewardStoreState {
  const policy = sourceRewardStorePolicy(layout, sourceRoom);
  switch (policy.kind) {
    case 'authoredBaseStore':
      return Object.freeze({
        kind: 'authoredBaseStore',
        baseRewardStoreKey: null,
      });
    case 'none':
      return Object.freeze({ kind: 'none' });
    case 'sourceOfferPoint':
      return Object.freeze({ kind: 'sourceOfferPoint' });
  }
}

function initialBatchState(layout: LinearBiomeLayout): AuthoredBatchState {
  if (
    layout.continuation.batchPolicy.kind !== 'standard' &&
    layout.continuation.batchPolicy.kind !== 'fields' &&
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    throw new Error(`${layout.biomeKey} does not use a supported authored batch policy`);
  }
  return createInitialBatchState(layout.continuation.batchPolicy);
}

function fixedSharedStore(layout: LinearBiomeLayout): string | undefined {
  const policy = layout.continuation.rewardStorePolicy;
  switch (policy.kind) {
    case 'authoredBaseStore':
      return undefined;
    case 'none':
      return undefined;
    case 'sourceOfferPoint':
      throw new Error(`${layout.biomeKey} derives its generated store from the source room`);
  }
}

function resolvedStoreForRoom(
  room: RoomDeclaration,
  sharedStoreKey: string | undefined,
): string | undefined {
  return room.individualRewardStoreKey ?? room.forcedRewardStoreKey ?? sharedStoreKey;
}

function finalBatchSharedStore(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  continuation: LinearBatchContinuation,
  replacement?: { readonly occurrenceId: OccurrenceId; readonly room: RoomDeclaration },
): string | undefined {
  const topology = plan.topology;
  if (topology === null) {
    throw new Error(`${layout.biomeKey} batch has no topology`);
  }
  if (continuation.rewardStore.kind === 'sourceOfferPoint') {
    if (continuation.parentOccurrenceId === null) {
      throw new Error(`${layout.biomeKey} source-derived batch has no authored source`);
    }
    const source = topology.occurrences.find(
      (occurrence) => occurrence.occurrenceId === continuation.parentOccurrenceId,
    );
    if (source === undefined) {
      throw new Error(`${layout.biomeKey} source-derived batch lost its source occurrence`);
    }
    if (source.state.kind !== 'shipCombat') {
      throw new Error(`${source.gameName} has no source reward wheel`);
    }
    const wheelKey = source.state.encounterCount === 3 ? 'wheel2' : 'wheel1';
    const wheel = source.state.wheels[wheelKey];
    if (wheel === undefined) {
      throw new Error(`${source.gameName} is missing ${wheelKey}`);
    }
    return wheel.storeKey;
  }
  let storeKey: string | undefined =
    continuation.rewardStore.kind === 'authoredBaseStore' &&
    continuation.rewardStore.baseRewardStoreKey !== null
      ? continuation.rewardStore.baseRewardStoreKey
      : undefined;
  const targetsInPhysicalOrder = [...continuation.targets].sort(
    (left, right) => left.exitIndex - right.exitIndex,
  );
  for (const target of targetsInPhysicalOrder) {
    const occurrence = topology.occurrences.find(
      (candidate) => candidate.occurrenceId === target.occurrenceId,
    );
    const targetRoom =
      target.occurrenceId === replacement?.occurrenceId
        ? replacement.room
        : occurrence === undefined
          ? undefined
          : catalog.rooms.byKey[occurrence.gameName];
    const forced = targetRoom?.forcedRewardStoreKey;
    if (forced !== undefined) {
      storeKey = forced;
    }
  }
  return storeKey;
}

export function isOccurrenceEntered(plan: LinearBiomePlan, occurrenceId: OccurrenceId): boolean {
  const topology = plan.topology;
  if (topology === null) {
    return false;
  }
  if (topology.startOccurrenceId === occurrenceId) {
    return true;
  }
  return topology.continuations.some(
    (continuation) =>
      continuation.pickedExitIndex !== null &&
      continuation.targets.some(
        (target) =>
          target.exitIndex === continuation.pickedExitIndex && target.occurrenceId === occurrenceId,
      ),
  );
}

export function resolvedStoreForOccurrence(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrenceId: OccurrenceId,
  replacementRoom?: RoomDeclaration,
): string | undefined {
  const topology = plan.topology;
  if (topology === null) {
    return fixedSharedStore(layout);
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  const room =
    replacementRoom ??
    (occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName]);
  if (room === undefined) {
    return fixedSharedStore(layout);
  }
  if (topology.startOccurrenceId === occurrenceId) {
    return resolvedStoreForRoom(room, fixedSharedStore(layout));
  }
  const owner = topology.continuations.find((continuation) =>
    continuation.targets.some((target) => target.occurrenceId === occurrenceId),
  );
  if (owner?.kind === 'batch') {
    return resolvedStoreForRoom(
      room,
      finalBatchSharedStore(
        plan,
        catalog,
        layout,
        owner,
        replacementRoom === undefined ? undefined : { occurrenceId, room: replacementRoom },
      ),
    );
  }
  return resolvedStoreForRoom(room, fixedSharedStore(layout));
}

function installEntryState(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): LinearBiomePlan {
  const occurrence = requireOccurrence(plan, occurrenceId, command);
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop !== undefined) {
    return plan;
  }
  const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
  return replaceOccurrence(
    plan,
    {
      ...occurrence,
      state: createDefaultRoomState(
        catalog,
        room,
        roomStateContext(
          occurrenceRole(plan, catalog, layout, occurrenceId, command),
          resolvedStoreForOccurrence(plan, catalog, layout, occurrenceId),
          true,
        ),
      ),
    },
    command,
  );
}

export function occurrenceRole(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
  replacementRoom?: RoomDeclaration,
): RoomOccurrenceRole {
  const topology = requireTopology(plan, command);
  if (topology.startOccurrenceId === occurrenceId) {
    return 'ordinary';
  }
  for (const continuation of topology.continuations) {
    const target = continuation.targets.find(
      (candidate) => candidate.occurrenceId === occurrenceId,
    );
    if (target !== undefined) {
      if (continuation.kind === 'terminal') {
        return target.exitIndex === 1 ? 'terminalShop' : 'terminalFreeReward';
      }
      const room =
        replacementRoom ??
        requireRoom(
          catalog,
          requireOccurrence(plan, occurrenceId, command).gameName,
          layout.biomeKey,
          command,
        );
      if (
        layout.terminal.kind === 'generatedTarget' &&
        room.gameName === layout.terminal.roomGameName
      ) {
        return 'terminalShop';
      }
      return 'ordinary';
    }
  }
  failCommand(command, `occurrence ${occurrenceId} has no structural owner`);
}

export function replaceOccurrence(
  plan: LinearBiomePlan,
  replacement: RoomOccurrence,
  command: ProjectCommand,
): LinearBiomePlan {
  const topology = requireTopology(plan, command);
  return {
    ...plan,
    topology: {
      ...topology,
      occurrences: topology.occurrences.map((occurrence) =>
        occurrence.occurrenceId === replacement.occurrenceId ? replacement : occurrence,
      ),
    },
  };
}

export function reconcileOwnedContinuationRewardStore(
  plan: LinearBiomePlan,
  layout: LinearBiomeLayout,
  occurrenceId: OccurrenceId,
  replacementRoom: RoomDeclaration,
  command: ProjectCommand,
): LinearBiomePlan {
  const topology = requireTopology(plan, command);
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === occurrenceId,
  );
  if (continuation === undefined) {
    return plan;
  }
  const currentRewardStore = continuation.rewardStore;
  if (currentRewardStore === undefined) {
    return plan;
  }
  const policy = sourceRewardStorePolicy(layout, replacementRoom);
  const replacementRewardStore =
    policy.kind === 'authoredBaseStore' &&
    currentRewardStore.kind === 'authoredBaseStore' &&
    (currentRewardStore.baseRewardStoreKey === null ||
      policy.storeKeys.includes(currentRewardStore.baseRewardStoreKey))
      ? currentRewardStore
      : initialBatchRewardStore(layout, replacementRoom);
  if (replacementRewardStore === currentRewardStore) {
    return plan;
  }
  return {
    ...plan,
    topology: {
      ...topology,
      continuations: topology.continuations.map((candidate) =>
        candidate.parentOccurrenceId === occurrenceId
          ? { ...continuation, rewardStore: replacementRewardStore }
          : candidate,
      ),
    },
  };
}

export function requireContinuation<Kind extends LinearContinuation['kind']>(
  plan: LinearBiomePlan,
  parentOccurrenceId: OccurrenceId | null,
  expectedKind: Kind,
  command: ProjectCommand,
): Extract<LinearContinuation, { readonly kind: Kind }> {
  const topology = requireTopology(plan, command);
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === parentOccurrenceId,
  );
  if (continuation?.kind !== expectedKind) {
    failCommand(command, `parent does not own a ${expectedKind} continuation`);
  }
  return continuation as Extract<LinearContinuation, { readonly kind: Kind }>;
}

function continuationSourceRoom(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  parentOccurrenceId: OccurrenceId | null,
  command: ProjectCommand,
): RoomDeclaration {
  if (parentOccurrenceId !== null) {
    const parent = requireOccurrence(plan, parentOccurrenceId, command);
    return requireRoom(catalog, parent.gameName, layout.biomeKey, command);
  }
  if (layout.start.kind !== 'fixedEntry') {
    failCommand(command, `${layout.biomeKey} has no layout-derived entry continuation`);
  }
  const source = layout.entries.at(-1) ?? layout.start;
  return requireRoom(catalog, source.roomGameName, layout.biomeKey, command);
}

function removeOccurrenceSubtrees(
  topology: LinearBiomeTopology,
  rootOccurrenceIds: readonly OccurrenceId[],
): LinearBiomeTopology {
  const removedOccurrenceIds = new Set<OccurrenceId>(rootOccurrenceIds);
  const pending = [...rootOccurrenceIds];

  while (pending.length > 0) {
    const parentOccurrenceId = pending.pop();
    if (parentOccurrenceId === undefined) {
      break;
    }
    const continuation = topology.continuations.find(
      (candidate) => candidate.parentOccurrenceId === parentOccurrenceId,
    );
    if (continuation === undefined) {
      continue;
    }
    for (const target of continuation.targets) {
      if (!removedOccurrenceIds.has(target.occurrenceId)) {
        removedOccurrenceIds.add(target.occurrenceId);
        pending.push(target.occurrenceId);
      }
    }
  }

  return {
    ...topology,
    occurrences: topology.occurrences.filter(
      (occurrence) => !removedOccurrenceIds.has(occurrence.occurrenceId),
    ),
    continuations: topology.continuations.filter(
      (continuation) =>
        continuation.parentOccurrenceId === null ||
        !removedOccurrenceIds.has(continuation.parentOccurrenceId),
    ),
  };
}

function removeContinuationSubtree(
  topology: LinearBiomeTopology,
  continuation: LinearContinuation,
): LinearBiomeTopology {
  const withoutContinuation = {
    ...topology,
    continuations: topology.continuations.filter(
      (candidate) => candidate.parentOccurrenceId !== continuation.parentOccurrenceId,
    ),
  };
  return removeOccurrenceSubtrees(
    withoutContinuation,
    continuation.targets.map((target) => target.occurrenceId),
  );
}

function createTerminalPlan(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  parentOccurrenceId: OccurrenceId,
  targetOccurrenceIds: readonly OccurrenceId[],
  command: ProjectCommand,
): LinearBiomePlan {
  if (layout.terminal.kind !== 'forkedTransition' && layout.terminal.kind !== 'directTransition') {
    failCommand(command, `${layout.biomeKey} does not use an authored terminal transition`);
  }
  const topology = requireTopology(plan, command);
  const stages = stagedProgressionStages(layout);
  if (stages !== undefined && nextStagedBatchIndex(topology) !== stages.length) {
    failCommand(command, `${layout.biomeKey} terminal follows ${stages.length} staged batches`);
  }
  const parent = requireOccurrence(plan, parentOccurrenceId, command);
  if (
    topology.continuations.some(
      (continuation) => continuation.parentOccurrenceId === parentOccurrenceId,
    )
  ) {
    failCommand(command, 'parent already owns a continuation');
  }
  const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeKey, command);
  const exitIndexes = generatedExitIndexes(parentRoom);
  if (exitIndexes.length === 0) {
    failCommand(command, `${parent.gameName} has no generated terminal exits`);
  }

  const terminalRoom = requireRoom(catalog, layout.terminal.roomGameName, layout.biomeKey, command);
  if (layout.terminal.kind === 'forkedTransition' && terminalRoom.entryOfferPolicy === undefined) {
    failCommand(command, `${terminalRoom.gameName} has no terminal offer policy`);
  }
  if (
    layout.terminal.kind === 'forkedTransition' &&
    exitIndexes.length > 1 + terminalRoom.entryOfferPolicy!.maxFreeRewards
  ) {
    failCommand(
      command,
      `${parent.gameName} exceeds ${terminalRoom.gameName} terminal exit capacity`,
    );
  }
  if (layout.terminal.kind === 'directTransition' && exitIndexes.length !== 1) {
    failCommand(command, `${parent.gameName} direct terminal requires exactly one exit`);
  }
  if (targetOccurrenceIds.length !== exitIndexes.length) {
    failCommand(command, `requires ${exitIndexes.length} terminal occurrence IDs`);
  }
  if (new Set(targetOccurrenceIds).size !== targetOccurrenceIds.length) {
    failCommand(command, 'terminal occurrence IDs must be unique');
  }
  for (const occurrenceId of targetOccurrenceIds) {
    if (topology.occurrences.some((occurrence) => occurrence.occurrenceId === occurrenceId)) {
      failCommand(command, `occurrence ${occurrenceId} already exists`);
    }
  }

  const terminalOccurrences = exitIndexes.map((exitIndex, index): RoomOccurrence => {
    const occurrenceId = targetOccurrenceIds[index];
    if (occurrenceId === undefined) {
      failCommand(command, `missing terminal occurrence ID for exit ${exitIndex}`);
    }
    const role: RoomOccurrenceRole =
      layout.terminal.kind === 'directTransition' || exitIndex === 1
        ? 'terminalShop'
        : 'terminalFreeReward';
    return {
      occurrenceId,
      gameName: terminalRoom.gameName,
      state: createDefaultRoomState(
        catalog,
        terminalRoom,
        roomStateContext(
          role,
          resolvedStoreForRoom(terminalRoom, fixedSharedStore(layout)),
          layout.terminal.kind === 'directTransition',
        ),
      ),
    };
  });
  const targets = exitIndexes.map((exitIndex, index) => {
    const occurrence = terminalOccurrences[index];
    if (occurrence === undefined) {
      failCommand(command, `missing terminal occurrence for exit ${exitIndex}`);
    }
    return { exitIndex, occurrenceId: occurrence.occurrenceId };
  });

  return {
    ...plan,
    topology: {
      ...topology,
      occurrences: [...topology.occurrences, ...terminalOccurrences],
      continuations: [
        ...topology.continuations,
        {
          kind: 'terminal',
          parentOccurrenceId,
          ...(layout.terminal.kind === 'directTransition'
            ? { rewardStore: initialBatchRewardStore(layout, parentRoom) }
            : {}),
          targets,
          pickedExitIndex: layout.terminal.kind === 'directTransition' ? 1 : null,
        },
      ],
    },
  };
}

function reconcilePlan(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  parentOccurrenceId: OccurrenceId | null,
  expectedKind: LinearContinuation['kind'],
  command: ProjectCommand,
): LinearBiomePlan {
  const topology = requireTopology(plan, command);
  const continuation = requireContinuation(plan, parentOccurrenceId, expectedKind, command);
  const parentRoom = continuationSourceRoom(plan, catalog, layout, parentOccurrenceId, command);
  const availableExitIndexes = new Set(generatedExitIndexes(parentRoom));
  if (
    continuation.pickedExitIndex !== null &&
    !availableExitIndexes.has(continuation.pickedExitIndex)
  ) {
    failCommand(command, `picked exit ${continuation.pickedExitIndex} remains unavailable`);
  }
  const unavailableTargets = continuation.targets.filter(
    (target) => !availableExitIndexes.has(target.exitIndex),
  );
  if (unavailableTargets.length === 0) {
    return plan;
  }
  const retainedTargets = continuation.targets.filter((target) =>
    availableExitIndexes.has(target.exitIndex),
  );
  const withReconciledContinuation = {
    ...topology,
    continuations: topology.continuations.map((candidate) =>
      candidate.parentOccurrenceId === parentOccurrenceId
        ? { ...continuation, targets: retainedTargets }
        : candidate,
    ),
  };
  return {
    ...plan,
    topology: removeOccurrenceSubtrees(
      withReconciledContinuation,
      unavailableTargets.map((target) => target.occurrenceId),
    ),
  };
}

export function applyLinearTopologyCommand(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  plan: LinearBiomePlan,
  layout: LinearBiomeLayout,
  command: LinearTopologyProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateStart': {
      if (plan.topology !== null) {
        failCommand(command, 'biome topology already has a start');
      }
      if (layout.start.kind !== 'authoredStart') {
        failCommand(command, `${layout.biomeKey} does not expose an authored start`);
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      if (!layout.start.roomGameNames.includes(room.gameName)) {
        failCommand(command, `${room.gameName} is not a declared start room`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(
          catalog,
          room,
          roomStateContext('ordinary', resolvedStoreForRoom(room, fixedSharedStore(layout)), true),
        ),
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          startOccurrenceId: command.occurrenceId,
          occurrences: [occurrence],
          continuations: [],
        },
      });
    }
    case 'CreateBatch': {
      const parentOccurrenceId = command.continuation.parentOccurrenceId;
      const topology =
        plan.topology ??
        (parentOccurrenceId === null && layout.start.kind === 'fixedEntry'
          ? { startOccurrenceId: null, occurrences: [], continuations: [] }
          : requireTopology(plan, command));
      const sourceRoom = continuationSourceRoom(
        { ...plan, topology },
        catalog,
        layout,
        parentOccurrenceId,
        command,
      );
      const stages = stagedProgressionStages(layout);
      if (stages !== undefined && nextStagedBatchIndex(topology) >= stages.length) {
        failCommand(command, `${layout.biomeKey} already has every staged batch`);
      }
      if (
        topology.continuations.some(
          (continuation) =>
            continuation.parentOccurrenceId === command.continuation.parentOccurrenceId,
        )
      ) {
        failCommand(command, 'parent already owns a continuation');
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: [
            ...topology.continuations,
            {
              kind: 'batch',
              parentOccurrenceId,
              rewardStore: initialBatchRewardStore(layout, sourceRoom),
              batchState: initialBatchState(layout),
              targets: [],
              pickedExitIndex: null,
            },
          ],
        },
      });
    }
    case 'CreateTerminalTransition':
      if (command.continuation.parentOccurrenceId === null) {
        failCommand(command, 'forked terminal transition requires an authored parent occurrence');
      }
      return withBiome(
        document,
        located,
        createTerminalPlan(
          plan,
          catalog,
          layout,
          command.continuation.parentOccurrenceId,
          command.targetOccurrenceIds,
          command,
        ),
      );
    case 'CreateTarget': {
      const topology = requireTopology(plan, command);
      if (topology.occurrences.some((room) => room.occurrenceId === command.occurrenceId)) {
        failCommand(command, `occurrence ${command.occurrenceId} already exists`);
      }
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.target.parentOccurrenceId,
      );
      if (continuation?.kind !== 'batch') {
        failCommand(command, 'target parent does not own an ordinary batch');
      }
      if (
        continuation.rewardStore.kind === 'authoredBaseStore' &&
        continuation.rewardStore.baseRewardStoreKey === null
      ) {
        failCommand(command, 'select the batch reward store before authoring targets');
      }
      if (layout.continuation.batchPolicy.kind === 'fields' && continuation.batchState === null) {
        failCommand(command, 'select the Fields cage outcome before authoring targets');
      }
      if (continuation.targets.some((target) => target.exitIndex === command.target.exitIndex)) {
        failCommand(command, `exit ${command.target.exitIndex} already has a target`);
      }
      const parentRoom = continuationSourceRoom(
        plan,
        catalog,
        layout,
        command.target.parentOccurrenceId,
        command,
      );
      if (!hasGeneratedExit(parentRoom, command.target.exitIndex)) {
        failCommand(
          command,
          `exit ${command.target.exitIndex} is unavailable from ${parentRoom.gameName}`,
        );
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      const stages = stagedProgressionStages(layout);
      const stageIndex = stagedBatchIndex(topology, command.target.parentOccurrenceId);
      if (stages !== undefined) {
        const stage = stageIndex === undefined ? undefined : stages[stageIndex];
        if (stage === undefined) {
          failCommand(command, `${layout.biomeKey} target has no staged candidate pool`);
        }
        if (!stagedRoomIsAvailable(stage, room.gameName)) {
          failCommand(command, `${room.gameName} is not available in stage ${stage.key}`);
        }
      }
      if (room.mode.kind !== 'authored') {
        failCommand(command, `${room.gameName} is layout-derived and cannot be authored`);
      }
      const generatedTerminal =
        layout.terminal.kind === 'generatedTarget' &&
        room.gameName === layout.terminal.roomGameName;
      if (
        room.kind === 'Intro' ||
        room.kind === 'Opening' ||
        (room.kind === 'Preboss' && !generatedTerminal)
      ) {
        failCommand(command, `${room.gameName} cannot be an ordinary generated target`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(
          catalog,
          room,
          roomStateContext(
            generatedTerminal ? 'terminalShop' : 'ordinary',
            resolvedStoreForRoom(room, finalBatchSharedStore(plan, catalog, layout, continuation)),
            false,
          ),
        ),
      };
      const updatedContinuation = {
        ...continuation,
        targets: [
          ...continuation.targets,
          { exitIndex: command.target.exitIndex, occurrenceId: command.occurrenceId },
        ],
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: [...topology.occurrences, occurrence],
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? updatedContinuation
              : candidate,
          ),
        },
      });
    }
    case 'SetPicked': {
      const topology = requireTopology(plan, command);
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.picked.parentOccurrenceId,
      );
      if (continuation?.kind !== 'batch') {
        failCommand(command, 'picked parent does not own an ordinary batch');
      }
      const target = continuation.targets.find(
        (candidate) => candidate.exitIndex === command.exitIndex,
      );
      if (target === undefined) {
        failCommand(command, `exit ${command.exitIndex} has no target`);
      }
      const parentRoom = continuationSourceRoom(
        plan,
        catalog,
        layout,
        command.picked.parentOccurrenceId,
        command,
      );
      if (!hasGeneratedExit(parentRoom, command.exitIndex)) {
        failCommand(
          command,
          `exit ${command.exitIndex} is unavailable from ${parentRoom.gameName}`,
        );
      }
      if (continuation.pickedExitIndex === command.exitIndex) {
        return document;
      }

      let oldPickedOccurrenceId: OccurrenceId | undefined;
      if (continuation.pickedExitIndex !== null) {
        oldPickedOccurrenceId = continuation.targets.find(
          (candidate) => candidate.exitIndex === continuation.pickedExitIndex,
        )?.occurrenceId;
      }
      const pickedOccurrence = requireOccurrence(plan, target.occurrenceId, command);
      if (
        layout.terminal.kind === 'generatedTarget' &&
        pickedOccurrence.gameName === layout.terminal.roomGameName &&
        oldPickedOccurrenceId !== undefined &&
        topology.continuations.some(
          (candidate) => candidate.parentOccurrenceId === oldPickedOccurrenceId,
        )
      ) {
        failCommand(command, 'remove the downstream continuation before picking the terminal room');
      }
      const continuations = topology.continuations.map((candidate) => {
        if (candidate.parentOccurrenceId === continuation.parentOccurrenceId) {
          return { ...continuation, pickedExitIndex: command.exitIndex };
        }
        if (
          oldPickedOccurrenceId !== undefined &&
          candidate.parentOccurrenceId === oldPickedOccurrenceId
        ) {
          return { ...candidate, parentOccurrenceId: target.occurrenceId };
        }
        return candidate;
      });
      const withPicked = { ...plan, topology: { ...topology, continuations } };
      return withBiome(
        document,
        located,
        installEntryState(withPicked, catalog, layout, target.occurrenceId, command),
      );
    }
    case 'SetTerminalPicked': {
      if (command.picked.parentOccurrenceId === null) {
        failCommand(command, 'terminal transition requires an authored parent occurrence');
      }
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.picked.parentOccurrenceId,
        'terminal',
        command,
      );
      const target = continuation.targets.find(
        (candidate) => candidate.exitIndex === command.exitIndex,
      );
      if (target === undefined) {
        failCommand(command, `exit ${command.exitIndex} has no terminal target`);
      }
      const parent = requireOccurrence(plan, command.picked.parentOccurrenceId, command);
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeKey, command);
      if (!hasGeneratedExit(parentRoom, command.exitIndex)) {
        failCommand(command, `exit ${command.exitIndex} is unavailable from ${parent.gameName}`);
      }
      if (continuation.pickedExitIndex === command.exitIndex) {
        return document;
      }
      const withPicked = {
        ...plan,
        topology: {
          ...topology,
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? { ...continuation, pickedExitIndex: command.exitIndex }
              : candidate,
          ),
        },
      };
      return withBiome(
        document,
        located,
        installEntryState(withPicked, catalog, layout, target.occurrenceId, command),
      );
    }
    case 'ReconcileExitCapacity': {
      const reconciled = reconcilePlan(
        plan,
        catalog,
        layout,
        command.continuation.parentOccurrenceId,
        'batch',
        command,
      );
      return reconciled === plan ? document : withBiome(document, located, reconciled);
    }
    case 'ReconcileTerminalExitCapacity': {
      const reconciled = reconcilePlan(
        plan,
        catalog,
        layout,
        command.continuation.parentOccurrenceId,
        'terminal',
        command,
      );
      return reconciled === plan ? document : withBiome(document, located, reconciled);
    }
    case 'RemoveBatch': {
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'batch',
        command,
      );
      if (continuation.parentOccurrenceId === null) {
        return withBiome(document, located, { ...plan, topology: null });
      }
      return withBiome(document, located, {
        ...plan,
        topology: removeContinuationSubtree(topology, continuation),
      });
    }
    case 'RemoveTerminalTransition': {
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'terminal',
        command,
      );
      return withBiome(document, located, {
        ...plan,
        topology: removeContinuationSubtree(topology, continuation),
      });
    }
    case 'ReplaceWithTerminalTransition': {
      if (command.continuation.parentOccurrenceId === null) {
        failCommand(command, 'forked terminal transition requires an authored parent occurrence');
      }
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'batch',
        command,
      );
      const withoutBatch = {
        ...plan,
        topology: removeContinuationSubtree(topology, continuation),
      };
      return withBiome(
        document,
        located,
        createTerminalPlan(
          withoutBatch,
          catalog,
          layout,
          command.continuation.parentOccurrenceId,
          command.targetOccurrenceIds,
          command,
        ),
      );
    }
    case 'ReplaceWithBatch': {
      if (command.continuation.parentOccurrenceId === null) {
        failCommand(command, 'terminal transition requires an authored parent occurrence');
      }
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'terminal',
        command,
      );
      const withoutTerminal = removeContinuationSubtree(topology, continuation);
      const sourceRoom = continuationSourceRoom(
        { ...plan, topology: withoutTerminal },
        catalog,
        layout,
        command.continuation.parentOccurrenceId,
        command,
      );
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...withoutTerminal,
          continuations: [
            ...withoutTerminal.continuations,
            {
              kind: 'batch',
              parentOccurrenceId: command.continuation.parentOccurrenceId,
              rewardStore: initialBatchRewardStore(layout, sourceRoom),
              batchState: initialBatchState(layout),
              targets: [],
              pickedExitIndex: null,
            },
          ],
        },
      });
    }
    case 'ClearTopology':
      return plan.topology === null
        ? document
        : withBiome(document, located, { ...plan, topology: null });
  }
}
