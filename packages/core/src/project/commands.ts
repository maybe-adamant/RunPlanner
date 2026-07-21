import type { Catalog, LinearBiomeLayout, RoomDeclaration } from '../catalog';
import type { ResolvedRewardOffer, RewardPayload } from '../rewardKernel/model';
import type {
  LinearBatchContinuation,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  ProjectDocument,
  RoomOccurrence,
} from './model';
import type {
  BiomeAddress,
  BatchRewardStoreAddress,
  ContinuationAddress,
  IncomingRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  RouteAddress,
  SemanticAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from './addresses';
import { createProjectAddress, semanticAddressKey } from './addresses';
import { createDefaultBatchState } from './batchState';
import { decodeProjectDocument } from './codec';
import { createDefaultRoomState, type RoomOccurrenceRole } from './roomState';
import { ProjectDocumentContractError } from './validation';

export type ProjectCommand =
  | { readonly kind: 'RenameProject'; readonly name: string }
  | {
      readonly kind: 'ConfigureRoutePrefix';
      readonly route: RouteAddress;
      readonly configuredBiomeCount: number;
    }
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | { readonly kind: 'CreateBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'ReplaceBatchRewardStore';
      readonly rewardStore: BatchRewardStoreAddress;
      readonly storeKey: string;
    }
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
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceShopOffer';
      readonly offer: ShopOfferAddress;
      readonly value: ResolvedRewardOffer;
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

type BiomeProjectCommand = Exclude<
  ProjectCommand,
  { readonly kind: 'ConfigureRoutePrefix' | 'RenameProject' }
>;

export function projectCommandAddress(command: ProjectCommand): SemanticAddress {
  switch (command.kind) {
    case 'RenameProject':
      return createProjectAddress();
    case 'ConfigureRoutePrefix':
      return command.route;
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
    case 'ReplaceBatchRewardStore':
      return command.rewardStore;
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
  throw new ProjectCommandContractError(command.kind, projectCommandAddress(command), detail);
}

function locateBiome(
  document: ProjectDocument,
  catalog: Catalog,
  command: BiomeProjectCommand,
): LocatedBiome {
  const address = projectCommandAddress(command);
  if (address.kind === 'project' || address.kind === 'route') {
    throw new Error('route command reached biome command resolution');
  }
  const routeIndex = document.routes.findIndex((route) => route.routeKey === address.routeKey);
  if (routeIndex < 0) {
    failCommand(command, `unknown or unconfigured route ${address.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `missing route ${address.routeKey}`);
  }
  const biomeIndex = route.biomes.findIndex((biome) => biome.biomeKey === address.biomeKey);
  if (biomeIndex < 0) {
    failCommand(command, `unknown or unconfigured biome ${address.biomeKey}`);
  }
  const plan = route.biomes[biomeIndex];
  if (plan === undefined) {
    failCommand(command, `missing biome ${address.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[address.biomeKey];
  if (layout === undefined) {
    failCommand(command, `catalog has no layout for ${address.biomeKey}`);
  }
  if (layout.kind !== 'LinearBiome') {
    failCommand(command, `${address.biomeKey} does not use authored linear topology`);
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
  biomeKey: string,
  command: ProjectCommand,
): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    failCommand(command, `unknown room ${gameName}`);
  }
  if (room.biomeKey !== biomeKey) {
    failCommand(command, `${gameName} belongs to ${room.biomeKey}`);
  }
  return room;
}

function hasGeneratedExit(room: RoomDeclaration, exitIndex: number): boolean {
  return room.exits.some((exit) => exit.index === exitIndex);
}

function generatedExitIndexes(room: RoomDeclaration): readonly number[] {
  return room.exits.map((exit) => exit.index).sort((left, right) => left - right);
}

function authoredBaseStorePolicy(layout: LinearBiomeLayout) {
  const policy = layout.continuation.rewardStorePolicy;
  if (
    policy.kind !== 'authoredBaseStore' ||
    layout.continuation.rewardStoreOverrides.length !== 0
  ) {
    throw new Error(`${layout.biomeKey} does not author a generated base store`);
  }
  return policy;
}

function authoredStart(layout: LinearBiomeLayout) {
  if (layout.start.kind !== 'authoredStart') {
    throw new Error(`${layout.biomeKey} does not expose an authored start`);
  }
  return layout.start;
}

function defaultBatchState(layout: LinearBiomeLayout): null {
  if (layout.continuation.batchPolicy.kind !== 'standard') {
    throw new Error(`${layout.biomeKey} does not use standard authored batches`);
  }
  const state = createDefaultBatchState(layout.continuation.batchPolicy);
  if (state !== null) {
    throw new Error(`${layout.biomeKey} standard batch produced non-null state`);
  }
  return state;
}

function resolvedStoreForRoom(room: RoomDeclaration, sharedStoreKey: string): string {
  return room.individualRewardStoreKey ?? room.forcedRewardStoreKey ?? sharedStoreKey;
}

function finalBatchSharedStore(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  continuation: LinearBatchContinuation,
  replacement?: { readonly occurrenceId: OccurrenceId; readonly room: RoomDeclaration },
): string {
  if (continuation.rewardStore.kind !== 'authoredBaseStore') {
    throw new Error('F/G batch must own an authored base store');
  }
  let storeKey = continuation.rewardStore.baseRewardStoreKey;
  const topology = plan.topology;
  if (topology === null) {
    throw new Error(`${layout.biomeKey} batch has no topology`);
  }
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

function isOccurrenceEntered(plan: LinearBiomePlan, occurrenceId: OccurrenceId): boolean {
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

function resolvedStoreForOccurrence(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrenceId: OccurrenceId,
  replacementRoom?: RoomDeclaration,
): string {
  const topology = plan.topology;
  if (topology === null) {
    return authoredBaseStorePolicy(layout).defaultStoreKey;
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  const room =
    replacementRoom ??
    (occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName]);
  if (room === undefined) {
    return authoredBaseStorePolicy(layout).defaultStoreKey;
  }
  if (topology.startOccurrenceId === occurrenceId) {
    return resolvedStoreForRoom(room, authoredBaseStorePolicy(layout).defaultStoreKey);
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
  return resolvedStoreForRoom(room, authoredBaseStorePolicy(layout).defaultStoreKey);
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
      state: createDefaultRoomState(catalog, room, {
        role: occurrenceRole(plan, occurrenceId, command),
        resolvedStoreKey: resolvedStoreForOccurrence(plan, catalog, layout, occurrenceId),
        entryActive: true,
      }),
    },
    command,
  );
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

function configureRoutePrefix(
  document: ProjectDocument,
  catalog: Catalog,
  command: Extract<ProjectCommand, { readonly kind: 'ConfigureRoutePrefix' }>,
): ProjectDocument {
  const routeDeclaration = catalog.routes.byKey[command.route.routeKey];
  if (routeDeclaration === undefined) {
    failCommand(command, `unknown route ${command.route.routeKey}`);
  }
  const configuredBiomeCount = command.configuredBiomeCount;
  if (!Number.isInteger(configuredBiomeCount) || configuredBiomeCount < 0) {
    failCommand(command, 'configuredBiomeCount must be a non-negative integer');
  }
  if (configuredBiomeCount > routeDeclaration.biomeKeys.length) {
    failCommand(
      command,
      `configuredBiomeCount exceeds the ${routeDeclaration.biomeKeys.length}-biome route`,
    );
  }
  const routeIndex = document.routes.findIndex(
    (route) => route.routeKey === command.route.routeKey,
  );
  if (routeIndex < 0) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  const route = document.routes[routeIndex];
  if (route === undefined) {
    failCommand(command, `project is missing route ${command.route.routeKey}`);
  }
  if (route.biomes.length === configuredBiomeCount) {
    return document;
  }

  const retainedBiomes = route.biomes.slice(0, configuredBiomeCount);
  const addedBiomes = routeDeclaration.biomeKeys
    .slice(route.biomes.length, configuredBiomeCount)
    .map((biomeKey) => {
      const layout = catalog.biomeLayouts.byKey[biomeKey];
      if (layout?.kind !== 'LinearBiome') {
        failCommand(command, `${biomeKey} has no supported authored plan initializer`);
      }
      return { kind: 'LinearBiome' as const, biomeKey, topology: null };
    });
  const replacement = { ...route, biomes: [...retainedBiomes, ...addedBiomes] };
  return {
    ...document,
    routes: document.routes.map((candidate, index) =>
      index === routeIndex ? replacement : candidate,
    ),
  };
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
  if (left.kind === 'BoonSource') {
    return right.kind === 'BoonSource' && left.source === right.source;
  }
  return (
    right.kind === 'DevotionPair' &&
    left.chosenSource === right.chosenSource &&
    left.spurnedSource === right.spurnedSource
  );
}

function sameOffer(left: ResolvedRewardOffer, right: ResolvedRewardOffer): boolean {
  return left.rewardType === right.rewardType && samePayload(left.payload, right.payload);
}

function requireContinuation<Kind extends LinearContinuation['kind']>(
  plan: LinearBiomePlan,
  parentOccurrenceId: OccurrenceId,
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
  if (layout.terminal.kind !== 'forkedTransition') {
    failCommand(command, `${layout.biomeKey} does not use a forked terminal transition`);
  }
  const topology = requireTopology(plan, command);
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
      state: createDefaultRoomState(catalog, terminalRoom, {
        role,
        resolvedStoreKey: resolvedStoreForRoom(
          terminalRoom,
          authoredBaseStorePolicy(layout).defaultStoreKey,
        ),
        entryActive: false,
      }),
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
  const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeKey, command);
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
  if (command.kind === 'RenameProject') {
    return command.name === document.name ? document : { ...document, name: command.name };
  }
  if (command.kind === 'ConfigureRoutePrefix') {
    return configureRoutePrefix(document, catalog, command);
  }
  const located = locateBiome(document, catalog, command);
  const { layout, plan } = located;

  switch (command.kind) {
    case 'CreateStart': {
      if (plan.topology !== null) {
        failCommand(command, 'biome topology already has a start');
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      if (!authoredStart(layout).roomGameNames.includes(room.gameName)) {
        failCommand(command, `${room.gameName} is not a declared start room`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, {
          role: 'ordinary',
          resolvedStoreKey: resolvedStoreForRoom(
            room,
            authoredBaseStorePolicy(layout).defaultStoreKey,
          ),
          entryActive: true,
        }),
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
              rewardStore: {
                kind: 'authoredBaseStore',
                baseRewardStoreKey: authoredBaseStorePolicy(layout).defaultStoreKey,
              },
              batchState: defaultBatchState(layout),
              targets: [],
              pickedExitIndex: null,
            },
          ],
        },
      });
    }
    case 'ReplaceBatchRewardStore': {
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.rewardStore.parentOccurrenceId,
        'batch',
        command,
      );
      if (continuation.rewardStore.kind !== 'authoredBaseStore') {
        failCommand(command, 'batch does not expose an authored base store');
      }
      if (!authoredBaseStorePolicy(layout).storeKeys.includes(command.storeKey)) {
        failCommand(command, `${command.storeKey} is not available from this batch policy`);
      }
      if (continuation.rewardStore.baseRewardStoreKey === command.storeKey) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          continuations: topology.continuations.map((candidate) =>
            candidate.parentOccurrenceId === continuation.parentOccurrenceId
              ? {
                  ...continuation,
                  rewardStore: {
                    kind: 'authoredBaseStore',
                    baseRewardStoreKey: command.storeKey,
                  },
                }
              : candidate,
          ),
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
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeKey, command);
      if (!hasGeneratedExit(parentRoom, command.target.exitIndex)) {
        failCommand(
          command,
          `exit ${command.target.exitIndex} is unavailable from ${parent.gameName}`,
        );
      }
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      if (room.mode.kind !== 'authored') {
        failCommand(command, `${room.gameName} is layout-derived and cannot be authored`);
      }
      if (room.kind === 'Intro' || room.kind === 'Opening' || room.kind === 'Preboss') {
        failCommand(command, `${room.gameName} cannot be an ordinary generated target`);
      }
      const occurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, {
          role: 'ordinary',
          resolvedStoreKey: resolvedStoreForRoom(
            room,
            finalBatchSharedStore(plan, catalog, layout, continuation),
          ),
          entryActive: false,
        }),
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
      const parentRoom = requireRoom(catalog, parent.gameName, layout.biomeKey, command);
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
      const withPicked = { ...plan, topology: { ...topology, continuations } };
      return withBiome(
        document,
        located,
        installEntryState(withPicked, catalog, layout, target.occurrenceId, command),
      );
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
              rewardStore: {
                kind: 'authoredBaseStore',
                baseRewardStoreKey: authoredBaseStorePolicy(layout).defaultStoreKey,
              },
              batchState: defaultBatchState(layout),
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
      const room = requireRoom(catalog, command.gameName, layout.biomeKey, command);
      const role = occurrenceRole(plan, occurrence.occurrenceId, command);
      const replacement = {
        occurrenceId: occurrence.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(catalog, room, {
          role,
          resolvedStoreKey: resolvedStoreForOccurrence(
            plan,
            catalog,
            layout,
            occurrence.occurrenceId,
            room,
          ),
          entryActive: isOccurrenceEntered(plan, occurrence.occurrenceId),
        }),
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceIncomingReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind !== 'counted' && occurrence.state.kind !== 'freeReward') {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      if (sameOffer(occurrence.state.offer, command.value)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: { ...occurrence.state, offer: command.value },
      };
      return withBiome(document, located, replaceOccurrence(plan, replacement, command));
    }
    case 'ReplaceShopOffer': {
      const occurrence = requireOccurrence(plan, command.offer.occurrenceId, command);
      if (occurrence.state.kind !== 'shop') {
        failCommand(command, `${occurrence.gameName} has no shop offer state`);
      }
      if (occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[command.offer.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${command.offer.offerKey}`);
      }
      if (sameOffer(offer.offer, command.value)) {
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
              [command.offer.offerKey]: { ...offer, offer: command.value },
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
      if (occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
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
        projectCommandAddress(command),
        `${error.path}: ${error.detail}`,
        { cause: error },
      );
    }
    throw error;
  }
}
