import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../catalog';
import type { ConcreteReward, RewardPayload } from '../rewards';
import type {
  CountedRewardChoice,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from './model';
import type {
  BiomeAddress,
  ContinuationAddress,
  IncomingRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  SemanticAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from './addresses';
import { semanticAddressKey } from './addresses';
import { decodeProjectDocument } from './codec';
import { createDefaultRoomState, type RoomOccurrenceRole } from './roomState';
import { ProjectDocumentContractError } from './validation';

export type ProjectCommand =
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | { readonly kind: 'CreateBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'CreateTerminalTransition';
      readonly continuation: ContinuationAddress;
      readonly targetOccurrenceIds: readonly OccurrenceId[];
    }
  | {
      readonly kind: 'CreateTarget';
      readonly target: TargetAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'SetPicked';
      readonly picked: PickedAddress;
      readonly exitIndex: number;
    }
  | {
      readonly kind: 'SetTerminalPicked';
      readonly picked: PickedAddress;
      readonly exitIndex: number;
    }
  | { readonly kind: 'ReconcileExitCapacity'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'ReconcileTerminalExitCapacity';
      readonly continuation: ContinuationAddress;
    }
  | { readonly kind: 'RemoveBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'RemoveTerminalTransition';
      readonly continuation: ContinuationAddress;
    }
  | {
      readonly kind: 'ReplaceWithTerminalTransition';
      readonly continuation: ContinuationAddress;
      readonly targetOccurrenceIds: readonly OccurrenceId[];
    }
  | { readonly kind: 'ReplaceWithBatch'; readonly continuation: ContinuationAddress }
  | { readonly kind: 'ClearTopology'; readonly biome: BiomeAddress }
  | {
      readonly kind: 'ReplaceOccurrenceRoom';
      readonly occurrence: OccurrenceAddress;
      readonly gameName: string;
    }
  | {
      readonly kind: 'ReplaceIncomingReward';
      readonly reward: IncomingRewardAddress;
      readonly choice: CountedRewardChoice;
    }
  | {
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly reward: ConcreteReward;
    }
  | {
      readonly kind: 'SetShopPurchase';
      readonly purchase: ShopPurchaseAddress;
      readonly purchased: boolean;
    };

export class ProjectCommandContractError extends Error {
  readonly commandKind: ProjectCommand['kind'];
  readonly addressKey: string;
  readonly detail: string;

  constructor(
    commandKind: ProjectCommand['kind'],
    address: SemanticAddress,
    detail: string,
    options?: ErrorOptions,
  ) {
    const addressKey = semanticAddressKey(address);
    super(`${commandKind} at ${addressKey}: ${detail}`, options);
    this.name = 'ProjectCommandContractError';
    this.commandKind = commandKind;
    this.addressKey = addressKey;
    this.detail = detail;
  }
}

interface LocatedBiome {
  readonly routeIndex: number;
  readonly biomeIndex: number;
  readonly plan: LinearBiomePlan;
  readonly layout: LinearBiomeLayout;
}

function commandAddress(command: ProjectCommand): SemanticAddress {
  switch (command.kind) {
    case 'CreateStart':
      return command.biome;
    case 'CreateBatch':
    case 'CreateTerminalTransition':
    case 'ReconcileExitCapacity':
    case 'ReconcileTerminalExitCapacity':
    case 'RemoveBatch':
    case 'RemoveTerminalTransition':
    case 'ReplaceWithBatch':
    case 'ReplaceWithTerminalTransition':
      return command.continuation;
    case 'CreateTarget':
      return command.target;
    case 'SetPicked':
    case 'SetTerminalPicked':
      return command.picked;
    case 'ClearTopology':
      return command.biome;
    case 'ReplaceOccurrenceRoom':
      return command.occurrence;
    case 'ReplaceIncomingReward':
      return command.reward;
    case 'ReplaceShopOffer':
      return command.offer;
    case 'SetShopPurchase':
      return command.purchase;
  }
}

function failCommand(command: ProjectCommand, detail: string): never {
  throw new ProjectCommandContractError(command.kind, commandAddress(command), detail);
}

function locateBiome(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): LocatedBiome {
  const address = commandAddress(command);
  const routeIndex = document.routes.findIndex((route) => route.routeKey === address.routeKey);
  if (routeIndex < 0) {
    failCommand(command, `unknown or unconfigured route ${address.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `missing route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((biome) => biome.biomeStepKey === address.biomeStepKey);
  if (biomeIndex < 0) {
    failCommand(command, `unknown or unconfigured biome ${address.biomeStepKey}`);
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    failCommand(command, `missing biome ${address.biomeStepKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[address.biomeStepKey];
  if (layout === undefined) {
    failCommand(command, `catalog has no layout for ${address.biomeStepKey}`);
  }
  return { routeIndex, biomeIndex, plan, layout };
}

function requireTopology(plan: LinearBiomePlan, command: ProjectCommand) {
  if (plan.topology === null) {
    failCommand(command, 'biome topology has not been started');
  }
  return plan.topology;
}

function requireOccurrence(
  plan: LinearBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrence {
  const topology = requireTopology(plan, command);
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) {
    failCommand(command, `unknown occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(
  catalog: Catalog,
  gameName: string,
  biomeStepKey: string,
  command: ProjectCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    failCommand(command, `unknown room ${gameName}`);
  }
  if (room.biomeStepKey !== biomeStepKey) {
    failCommand(command, `${gameName} belongs to ${room.biomeStepKey}`);
  }
  return room;
}

function hasGeneratedExit(room: RoomDeclaration, exitIndex: number): boolean {
  return room.exits.some((exit) => exit.index === exitIndex && exit.targetMode === 'generated');
}

function generatedExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits
    .filter((exit) => exit.targetMode === 'generated')
    .map((exit) => exit.index)
    .sort((left, right) => left - right);
}

function occurrenceRole(
  plan: LinearBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
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
      return 'ordinary';
    }
  }
  failCommand(command, `occurrence ${occurrenceId} has no structural owner`);
}

function withBiome(
  document: ProjectDocument,
  located: LocatedBiome,
  plan: LinearBiomePlan,
): ProjectDocument {
  const route = document.routes[located.routeIndex];
  if (route === undefined) {
    throw new Error('located route disappeared');
  }
  const biomes = route.biomes.map((biome, index) => (index === located.biomeIndex ? plan : biome));
  const routes = document.routes.map((candidate, index) =>
    index === located.routeIndex ? { ...route, biomes } : candidate,
  );
  return { ...document, routes };
}

function replaceOccurrence(
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

function samePayload(left: RewardPayload | undefined, right: RewardPayload | undefined): boolean {
  if (left === undefined || right === undefined) {
    return left === right;
  }
  if ('source' in left || 'source' in right) {
    return 'source' in left && 'source' in right && left.source === right.source;
  }
  return left.sources[0] === right.sources[0] && left.sources[1] === right.sources[1];
}

function sameReward(left: ConcreteReward, right: ConcreteReward): boolean {
  return left.rewardType === right.rewardType && samePayload(left.payload, right.payload);
}

function sameChoice(left: CountedRewardChoice, right: CountedRewardChoice): boolean {
  return left.storeKey === right.storeKey && sameReward(left.reward, right.reward);
}

function requireContinuation(
  plan: LinearBiomePlan,
  parentOccurrenceId: OccurrenceId,
  expectedKind: LinearContinuation['kind'],
  command: ProjectCommand,
): LinearContinuation {
  const topology = requireTopology(plan, command);
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === parentOccurrenceId,
  );
  if (continuation?.kind !== expectedKind) {
    failCommand(command, `parent does not own a ${expectedKind} continuation`);
  }
  return continuation;
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
      (continuation) => !removedOccurrenceIds.has(continuation.parentOccurrenceId),
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
  const topology = requireTopology(plan, command);
  const parent = requireOccurrence(plan, parentOccurrenceId, command);
  if (
    topology.continuations.some(
      (continuation) => continuation.parentOccurrenceId === parentOccurrenceId,
    )
  ) {
    failCommand(command, 'parent already owns a continuation');
  }
  const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
  const exitIndexes = generatedExitIndexes(parentRoom);
  if (exitIndexes.length === 0) {
    failCommand(command, `${parent.gameName} has no generated terminal exits`);
  }

  const terminalRoom = requireRoom(
    catalog,
    layout.terminal.roomGameName,
    layout.biomeStepKey,
    command,
  );
  if (terminalRoom.entryOfferPolicy === undefined) {
    failCommand(command, `${terminalRoom.gameName} has no terminal offer policy`);
  }
  if (exitIndexes.length > 1 + terminalRoom.entryOfferPolicy.maxFreeRewards) {
    failCommand(
      command,
      `${parent.gameName} exceeds ${terminalRoom.gameName} terminal exit capacity`,
    );
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
    const role: RoomOccurrenceRole = exitIndex === 1 ? 'terminalShop' : 'terminalFreeReward';
    return {
      occurrenceId,
      gameName: terminalRoom.gameName,
      state: createDefaultRoomState(catalog, terminalRoom, role),
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
        { kind: 'terminal', parentOccurrenceId, targets, pickedExitIndex: null },
      ],
    },
  };
}

function reconcilePlan(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  parentOccurrenceId: OccurrenceId,
  expectedKind: LinearContinuation['kind'],
  command: ProjectCommand,
): LinearBiomePlan {
  const topology = requireTopology(plan, command);
  const continuation = requireContinuation(plan, parentOccurrenceId, expectedKind, command);
  const parent = requireOccurrence(plan, parentOccurrenceId, command);
  const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
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

function applyUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  const located = locateBiome(document, catalog, command);
  const { layout, plan } = located;

  switch (command.kind) {
    case 'CreateStart': {
      if (plan.topology !== null) {
        failCommand(command, 'biome topology already has a start');
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      if (!layout.start.roomGameNames.includes(room.gameName)) {
        failCommand(command, `${room.gameName} is not a declared start room`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room),
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
      const topology = requireTopology(plan, command);
      requireOccurrence(plan, command.continuation.parentOccurrenceId, command);
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
              parentOccurrenceId: command.continuation.parentOccurrenceId,
              targets: [],
              pickedExitIndex: null,
            },
          ],
        },
      });
    }
    case 'CreateTerminalTransition':
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
      if (continuation.targets.some((target) => target.exitIndex === command.target.exitIndex)) {
        failCommand(command, `exit ${command.target.exitIndex} already has a target`);
      }
      const parent = requireOccurrence(plan, command.target.parentOccurrenceId, command);
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
      if (!hasGeneratedExit(parentRoom, command.target.exitIndex)) {
        failCommand(
          command,
          `exit ${command.target.exitIndex} is unavailable from ${parent.gameName}`,
        );
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      if (room.kind === 'Intro' || room.kind === 'Opening' || room.kind === 'Preboss') {
        failCommand(command, `${room.gameName} cannot be an ordinary generated target`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room),
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
      const parent = requireOccurrence(plan, command.picked.parentOccurrenceId, command);
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
      if (!hasGeneratedExit(parentRoom, command.exitIndex)) {
        failCommand(command, `exit ${command.exitIndex} is unavailable from ${parent.gameName}`);
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
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, continuations },
      });
    }
    case 'SetTerminalPicked': {
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
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeStepKey, command);
      if (!hasGeneratedExit(parentRoom, command.exitIndex)) {
        failCommand(command, `exit ${command.exitIndex} is unavailable from ${parent.gameName}`);
      }
      if (continuation.pickedExitIndex === command.exitIndex) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? { ...continuation, pickedExitIndex: command.exitIndex }
              : candidate,
          ),
        },
      });
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
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'terminal',
        command,
      );
      const withoutTerminal = removeContinuationSubtree(topology, continuation);
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...withoutTerminal,
          continuations: [
            ...withoutTerminal.continuations,
            {
              kind: 'batch',
              parentOccurrenceId: command.continuation.parentOccurrenceId,
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
    case 'ReplaceOccurrenceRoom': {
      const occurrence = requireOccurrence(plan, command.occurrence.occurrenceId, command);
      if (occurrence.gameName === command.gameName) {
        return document;
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeStepKey, command);
      const role = occurrenceRole(plan, occurrence.occurrenceId, command);
      const replacement = {
        occurrenceId: occurrence.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, role),
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceIncomingReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind !== 'counted' && occurrence.state.kind !== 'freeReward') {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      if (sameChoice(occurrence.state.choice, command.choice)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: { ...occurrence.state, choice: command.choice },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceShopOffer': {
      const occurrence = requireOccurrence(plan, command.offer.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop offer state`);
      }
      const offer = occurrence.state.shop.offers[command.offer.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
      }
      if (sameReward(offer.reward, command.reward)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          shop: {
            ...occurrence.state.shop,
            offers: {
              ...occurrence.state.shop.offers,
              [command.offer.offerKey]: { ...offer, reward: command.reward },
            },
          },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'SetShopPurchase': {
      const occurrence = requireOccurrence(plan, command.purchase.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop purchase state`);
      }
      const offer = occurrence.state.shop.offers[command.purchase.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.purchase.offerKey}`);
      }
      if (typeof command.purchased !== 'boolean') {
        failCommand(command, 'purchased must be a boolean');
      }
      if (offer.purchased === command.purchased) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          shop: {
            ...occurrence.state.shop,
            offers: {
              ...occurrence.state.shop.offers,
              [command.purchase.offerKey]: { ...offer, purchased: command.purchased },
            },
          },
        },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
  }
}

export function applyProjectCommand(
  document: ProjectDocument,
  catalog: Catalog,
  command: ProjectCommand,
): ProjectDocument {
  try {
    const proposal = applyUnchecked(document, catalog, command);
    return proposal === document ? document : decodeProjectDocument(proposal, catalog);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) {
      throw error;
    }
    if (error instanceof ProjectDocumentContractError) {
      throw new ProjectCommandContractError(
        command.kind,
        commandAddress(command),
        `${error.path}: ${error.detail}`,
        { cause: error },
      );
    }
    throw error;
  }
}
