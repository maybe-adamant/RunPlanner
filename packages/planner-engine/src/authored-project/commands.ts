import type {
  BiomeLayout,
  Catalog,
  FixedAuthoredSlotDescriptor,
  HubBiomeLayout,
  LinearBiomeLayout,
  RewardWheelOfferPoint,
  RoomDeclaration,
} from '../catalog-schema';
import type { ResolvedRewardOffer, RewardPayload } from '../reward-kernel/model';
import { createDefaultBiomeState, replaceBiomeStateField } from './biomeState';
import type {
  AuthoredBatchState,
  AuthoredBiomePlan,
  AuthoredFieldValue,
  BatchRewardStoreState,
  HubBiomePlan,
  HubBiomeTopology,
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
  BiomeFieldAddress,
  BatchRewardStoreAddress,
  ContinuationAddress,
  HubSlotAddress,
  HubVisitAddress,
  IncomingRewardAddress,
  LocalChildAddress,
  LocalChildGroupAddress,
  LocalRewardAddress,
  OccurrenceAddress,
  PickedAddress,
  RewardWheelAddress,
  RewardWheelOfferAddress,
  RouteAddress,
  SemanticAddress,
  ShopOfferAddress,
  ShopPurchaseAddress,
  TargetAddress,
} from './addresses';
import { createProjectAddress, semanticAddressKey } from './addresses';
import { createDefaultBatchState } from './batchState';
import { decodeProjectDocument } from './codec';
import {
  createDefaultRoomState,
  type RoomOccurrenceRole,
  type RoomStateContext,
} from './roomState';
import { ProjectDocumentContractError } from './validation';
import {
  nextStagedBatchIndex,
  stagedBatchIndex,
  stagedProgressionStages,
  stagedRoomIsAvailable,
} from './stagedProgression';

export type ProjectCommand =
  | { readonly kind: 'RenameProject'; readonly name: string }
  | {
      readonly kind: 'ConfigureRoutePrefix';
      readonly route: RouteAddress;
      readonly configuredBiomeCount: number;
    }
  | {
      readonly kind: 'ReplaceBiomeField';
      readonly field: BiomeFieldAddress;
      readonly value: AuthoredFieldValue;
    }
  | {
      readonly kind: 'CreateStart';
      readonly biome: BiomeAddress;
      readonly occurrenceId: OccurrenceId;
      readonly gameName: string;
    }
  | {
      readonly kind: 'CreateHubTopology';
      readonly biome: BiomeAddress;
      readonly fixedOccurrenceIds: Readonly<Record<string, OccurrenceId>>;
    }
  | {
      readonly kind: 'OpenHubSlot';
      readonly slot: HubSlotAddress;
      readonly occurrenceId: OccurrenceId;
    }
  | { readonly kind: 'CloseHubSlot'; readonly slot: HubSlotAddress }
  | {
      readonly kind: 'AppendHubVisit';
      readonly visit: HubVisitAddress;
      readonly hubSlotKey: string;
    }
  | {
      readonly kind: 'ReplaceHubVisit';
      readonly visit: HubVisitAddress;
      readonly hubSlotKey: string;
    }
  | { readonly kind: 'RemoveHubVisitsFrom'; readonly visit: HubVisitAddress }
  | {
      readonly kind: 'ReplaceSideRoomGeneration';
      readonly sideRoom: LocalChildAddress;
      readonly generation: 'generated' | 'notGenerated';
    }
  | {
      readonly kind: 'ReplaceSideRoomEntryOrder';
      readonly group: LocalChildGroupAddress;
      readonly enteredSlotKeys: readonly string[];
    }
  | { readonly kind: 'CreateBatch'; readonly continuation: ContinuationAddress }
  | {
      readonly kind: 'ReplaceBatchRewardStore';
      readonly rewardStore: BatchRewardStoreAddress;
      readonly storeKey: string;
    }
  | {
      readonly kind: 'ReplaceFieldsCageOutcome';
      readonly continuation: ContinuationAddress;
      readonly cageOutcome: 'min' | 'max';
    }
  | {
      readonly kind: 'ReplaceShipEncounterCount';
      readonly occurrence: OccurrenceAddress;
      readonly encounterCount: 2 | 3;
    }
  | {
      readonly kind: 'ReplaceRewardWheelOfferCount';
      readonly wheel: RewardWheelAddress;
      readonly offerCount: number;
    }
  | {
      readonly kind: 'ReplaceRewardWheelStore';
      readonly wheel: RewardWheelAddress;
      readonly storeKey: string;
    }
  | {
      readonly kind: 'ReplaceRewardWheelOffer';
      readonly offer: RewardWheelOfferAddress;
      readonly value: ResolvedRewardOffer;
    }
  | {
      readonly kind: 'ReplaceRewardWheelPicked';
      readonly wheel: RewardWheelAddress;
      readonly pickedOfferIndex: number;
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
      readonly kind: 'ReplaceLocalReward';
      readonly reward: LocalRewardAddress;
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
  readonly plan: AuthoredBiomePlan;
  readonly layout: BiomeLayout;
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
    case 'CreateHubTopology':
      return command.biome;
    case 'OpenHubSlot':
    case 'CloseHubSlot':
      return command.slot;
    case 'AppendHubVisit':
    case 'ReplaceHubVisit':
    case 'RemoveHubVisitsFrom':
      return command.visit;
    case 'ReplaceSideRoomGeneration':
      return command.sideRoom;
    case 'ReplaceSideRoomEntryOrder':
      return command.group;
    case 'ReplaceBiomeField':
      return command.field;
    case 'ReplaceShipEncounterCount':
      return command.occurrence;
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
      return command.wheel;
    case 'ReplaceRewardWheelOffer':
      return command.offer;
    case 'CreateBatch':
    case 'ReplaceFieldsCageOutcome':
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
    case 'ReplaceLocalReward':
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
  if (layout.kind !== plan.kind) {
    failCommand(command, `${address.biomeKey} plan does not match its ${layout.kind} layout`);
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

function requireRewardWheel(
  plan: LinearBiomePlan,
  catalog: Catalog,
  layout: LinearBiomeLayout,
  address: RewardWheelAddress | RewardWheelOfferAddress,
  command: ProjectCommand,
): {
  readonly occurrence: RoomOccurrence;
  readonly state: Extract<RoomOccurrence['state'], { readonly kind: 'shipCombat' }>;
  readonly descriptor: RewardWheelOfferPoint;
} {
  const occurrence = requireOccurrence(plan, address.occurrenceId, command);
  if (occurrence.state.kind !== 'shipCombat') {
    failCommand(command, `${occurrence.gameName} has no reward wheels`);
  }
  const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  const descriptor = profile?.phases.find(
    (phase) => phase.offerPoint?.key === address.wheelKey,
  )?.offerPoint;
  if (descriptor === undefined) {
    failCommand(command, `${occurrence.gameName} has no wheel ${address.wheelKey}`);
  }
  if (occurrence.state.wheels[address.wheelKey] === undefined) {
    failCommand(command, `${occurrence.gameName} is missing wheel state ${address.wheelKey}`);
  }
  return { occurrence, state: occurrence.state, descriptor };
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

function defaultBatchRewardStore(
  layout: LinearBiomeLayout,
  sourceRoom: RoomDeclaration,
): BatchRewardStoreState {
  const policy = sourceRewardStorePolicy(layout, sourceRoom);
  switch (policy.kind) {
    case 'authoredBaseStore':
      return Object.freeze({
        kind: 'authoredBaseStore',
        baseRewardStoreKey: policy.defaultStoreKey,
      });
    case 'none':
      return Object.freeze({ kind: 'none' });
    case 'sourceOfferPoint':
      return Object.freeze({ kind: 'sourceOfferPoint' });
  }
}

function defaultBatchState(layout: LinearBiomeLayout): AuthoredBatchState {
  if (
    layout.continuation.batchPolicy.kind !== 'standard' &&
    layout.continuation.batchPolicy.kind !== 'fields' &&
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    throw new Error(`${layout.biomeKey} does not use a supported authored batch policy`);
  }
  return createDefaultBatchState(layout.continuation.batchPolicy);
}

function defaultSharedStore(layout: LinearBiomeLayout): string | undefined {
  const policy = layout.continuation.rewardStorePolicy;
  switch (policy.kind) {
    case 'authoredBaseStore':
      return policy.defaultStoreKey;
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

function roomStateContext(
  role: RoomOccurrenceRole,
  resolvedStoreKey: string | undefined,
  entryActive: boolean,
): RoomStateContext {
  return {
    role,
    ...(resolvedStoreKey === undefined ? {} : { resolvedStoreKey }),
    entryActive,
  };
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
  let storeKey =
    continuation.rewardStore.kind === 'authoredBaseStore'
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
): string | undefined {
  const topology = plan.topology;
  if (topology === null) {
    return defaultSharedStore(layout);
  }
  const occurrence = topology.occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  const room =
    replacementRoom ??
    (occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName]);
  if (room === undefined) {
    return defaultSharedStore(layout);
  }
  if (topology.startOccurrenceId === occurrenceId) {
    return resolvedStoreForRoom(room, defaultSharedStore(layout));
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
  return resolvedStoreForRoom(room, defaultSharedStore(layout));
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

function occurrenceRole(
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

function withBiome(
  document: ProjectDocument,
  located: LocatedBiome,
  plan: AuthoredBiomePlan,
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
      if (layout === undefined) {
        failCommand(command, `${biomeKey} has no authored plan initializer`);
      }
      return layout.kind === 'LinearBiome'
        ? {
            kind: 'LinearBiome' as const,
            biomeKey,
            state: createDefaultBiomeState(layout),
            topology: null,
          }
        : { kind: 'HubBiome' as const, biomeKey, topology: null };
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

function reconcileOwnedContinuationRewardStore(
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
    policy.storeKeys.includes(currentRewardStore.baseRewardStoreKey)
      ? currentRewardStore
      : defaultBatchRewardStore(layout, replacementRoom);
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
          resolvedStoreForRoom(terminalRoom, defaultSharedStore(layout)),
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
            ? { rewardStore: defaultBatchRewardStore(layout, parentRoom) }
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

function requireHubTopology(plan: HubBiomePlan, command: ProjectCommand): HubBiomeTopology {
  if (plan.topology === null) {
    failCommand(command, 'Hub topology has not been started');
  }
  return plan.topology;
}

function requireHubOccurrence(
  plan: HubBiomePlan,
  occurrenceId: OccurrenceId,
  command: ProjectCommand,
): RoomOccurrence {
  const occurrence = requireHubTopology(plan, command).occurrences.find(
    (candidate) => candidate.occurrenceId === occurrenceId,
  );
  if (occurrence === undefined) {
    failCommand(command, `unknown Hub occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function replaceHubOccurrence(
  plan: HubBiomePlan,
  replacement: RoomOccurrence,
  command: ProjectCommand,
): HubBiomePlan {
  const topology = requireHubTopology(plan, command);
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

function requireEphyraSideGroup(
  occurrence: RoomOccurrence,
  catalog: Catalog,
  layout: HubBiomeLayout,
  groupKey: string,
  command: ProjectCommand,
) {
  if (occurrence.state.kind !== 'ephyraCombat') {
    failCommand(command, `${occurrence.gameName} has no Ephyra side-room state`);
  }
  const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
  const group = room.localChildren.find((child) => child.key === groupKey);
  if (group?.kind !== 'fixedRoomSlots') {
    failCommand(command, `${occurrence.gameName} has no side-room group ${groupKey}`);
  }
  return { state: occurrence.state, group };
}

function applyHubUnchecked(
  document: ProjectDocument,
  catalog: Catalog,
  located: LocatedBiome,
  plan: HubBiomePlan,
  layout: HubBiomeLayout,
  command: BiomeProjectCommand,
): ProjectDocument {
  switch (command.kind) {
    case 'CreateHubTopology': {
      if (plan.topology !== null) {
        failCommand(command, 'Hub topology already exists');
      }
      if (
        layout.entries.some((entry) => entry.kind !== 'fixedAuthoredSlot') ||
        layout.terminal.kind !== 'fixedAuthoredSlot'
      ) {
        failCommand(command, `${layout.biomeKey} has no supported fixed Hub boundary`);
      }
      const descriptors: readonly FixedAuthoredSlotDescriptor[] = [
        ...(layout.entries as readonly FixedAuthoredSlotDescriptor[]),
        layout.terminal,
      ];
      const terminalSlotKey = layout.terminal.slotKey;
      const expectedKeys = descriptors.map((descriptor) => descriptor.slotKey).sort();
      const actualKeys = Object.keys(command.fixedOccurrenceIds).sort();
      if (
        expectedKeys.length !== actualKeys.length ||
        expectedKeys.some((key, index) => key !== actualKeys[index])
      ) {
        failCommand(command, `fixed occurrence IDs must contain ${expectedKeys.join(', ')}`);
      }
      const ids = descriptors.map((descriptor) => command.fixedOccurrenceIds[descriptor.slotKey]);
      if (ids.some((id) => id === undefined) || new Set(ids).size !== ids.length) {
        failCommand(command, 'fixed occurrence IDs must be present and unique');
      }
      const occurrences = descriptors.map((descriptor, index): RoomOccurrence => {
        const id = ids[index];
        if (id === undefined) {
          failCommand(command, `missing occurrence ID for ${descriptor.slotKey}`);
        }
        const room = requireRoom(catalog, descriptor.roomGameName, layout.biomeKey, command);
        return {
          occurrenceId: id,
          gameName: room.gameName,
          state: createDefaultRoomState(
            catalog,
            room,
            roomStateContext(
              descriptor.slotKey === terminalSlotKey ? 'terminalShop' : 'ordinary',
              room.forcedRewardStoreKey ?? room.individualRewardStoreKey,
              true,
            ),
          ),
        };
      });
      return withBiome(document, located, {
        ...plan,
        topology: {
          occurrences,
          fixedRooms: descriptors.map((descriptor, index) => {
            const occurrence = occurrences[index];
            if (occurrence === undefined) {
              failCommand(command, `missing fixed occurrence for ${descriptor.slotKey}`);
            }
            return {
              fixedSlotKey: descriptor.slotKey,
              occurrenceId: occurrence.occurrenceId,
            };
          }),
          openTargets: [],
          visitOrder: [],
        },
      });
    }
    case 'OpenHubSlot': {
      const topology = requireHubTopology(plan, command);
      if (topology.openTargets.length >= layout.hub.openCount.max) {
        failCommand(command, `Hub already has ${layout.hub.openCount.max} open slots`);
      }
      if (topology.openTargets.some((target) => target.hubSlotKey === command.slot.hubSlotKey)) {
        failCommand(command, `${command.slot.hubSlotKey} is already open`);
      }
      if (
        topology.occurrences.some((occurrence) => occurrence.occurrenceId === command.occurrenceId)
      ) {
        failCommand(command, `occurrence ${command.occurrenceId} already exists`);
      }
      const slot = layout.hub.slots.find(
        (candidate) => candidate.slotKey === command.slot.hubSlotKey,
      );
      if (slot === undefined) {
        failCommand(command, `unknown Hub slot ${command.slot.hubSlotKey}`);
      }
      const room = requireRoom(catalog, slot.roomGameName, layout.biomeKey, command);
      const occurrence: RoomOccurrence = {
        occurrenceId: command.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(
          catalog,
          room,
          roomStateContext(
            'ordinary',
            room.forcedRewardStoreKey ?? room.individualRewardStoreKey,
            false,
          ),
        ),
      };
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: [...topology.occurrences, occurrence],
          openTargets: [
            ...topology.openTargets,
            { hubSlotKey: slot.slotKey, occurrenceId: occurrence.occurrenceId },
          ],
        },
      });
    }
    case 'CloseHubSlot': {
      const topology = requireHubTopology(plan, command);
      const target = topology.openTargets.find(
        (candidate) => candidate.hubSlotKey === command.slot.hubSlotKey,
      );
      if (target === undefined) {
        failCommand(command, `${command.slot.hubSlotKey} is not open`);
      }
      if (topology.visitOrder.includes(command.slot.hubSlotKey)) {
        failCommand(command, 'replace or remove the referenced Hub visit before closing this slot');
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          occurrences: topology.occurrences.filter(
            (occurrence) => occurrence.occurrenceId !== target.occurrenceId,
          ),
          openTargets: topology.openTargets.filter(
            (candidate) => candidate.hubSlotKey !== command.slot.hubSlotKey,
          ),
        },
      });
    }
    case 'AppendHubVisit': {
      const topology = requireHubTopology(plan, command);
      if (command.visit.visitIndex !== topology.visitOrder.length + 1) {
        failCommand(command, `next Hub visit index is ${topology.visitOrder.length + 1}`);
      }
      if (topology.visitOrder.length >= layout.hub.requiredVisits) {
        failCommand(command, `Hub already has ${layout.hub.requiredVisits} visits`);
      }
      if (!topology.openTargets.some((target) => target.hubSlotKey === command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is not an open Hub slot`);
      }
      if (topology.visitOrder.includes(command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is already visited`);
      }
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, visitOrder: [...topology.visitOrder, command.hubSlotKey] },
      });
    }
    case 'ReplaceHubVisit': {
      const topology = requireHubTopology(plan, command);
      const visitIndex = command.visit.visitIndex - 1;
      if (topology.visitOrder[visitIndex] === undefined) {
        failCommand(command, `unknown Hub visit ${command.visit.visitIndex}`);
      }
      if (!topology.openTargets.some((target) => target.hubSlotKey === command.hubSlotKey)) {
        failCommand(command, `${command.hubSlotKey} is not an open Hub slot`);
      }
      if (
        topology.visitOrder.some(
          (hubSlotKey, index) => index !== visitIndex && hubSlotKey === command.hubSlotKey,
        )
      ) {
        failCommand(command, `${command.hubSlotKey} is already visited`);
      }
      if (topology.visitOrder[visitIndex] === command.hubSlotKey) {
        return document;
      }
      return withBiome(document, located, {
        ...plan,
        topology: {
          ...topology,
          visitOrder: topology.visitOrder.map((hubSlotKey, index) =>
            index === visitIndex ? command.hubSlotKey : hubSlotKey,
          ),
        },
      });
    }
    case 'RemoveHubVisitsFrom': {
      const topology = requireHubTopology(plan, command);
      const visitIndex = command.visit.visitIndex - 1;
      if (topology.visitOrder[visitIndex] === undefined) {
        failCommand(command, `unknown Hub visit ${command.visit.visitIndex}`);
      }
      return withBiome(document, located, {
        ...plan,
        topology: { ...topology, visitOrder: topology.visitOrder.slice(0, visitIndex) },
      });
    }
    case 'ReplaceSideRoomGeneration': {
      const occurrence = requireHubOccurrence(plan, command.sideRoom.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
        command.sideRoom.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.sideRoom.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.sideRoom.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.sideRoom.slotKey];
      if (sideRoom === undefined) {
        failCommand(command, `missing side-room state ${command.sideRoom.slotKey}`);
      }
      if (command.generation !== 'generated' && command.generation !== 'notGenerated') {
        failCommand(command, 'side-room generation must be generated or notGenerated');
      }
      if (command.generation === 'notGenerated' && sideRoom.enteredOrdinal !== null) {
        failCommand(command, 'remove the side room from entry order before disabling generation');
      }
      if (sideRoom.generation === command.generation) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              sideRooms: {
                ...state.sideRooms,
                [command.sideRoom.slotKey]: {
                  ...sideRoom,
                  generation: command.generation,
                },
              },
            },
          },
          command,
        ),
      );
    }
    case 'ReplaceSideRoomEntryOrder': {
      const occurrence = requireHubOccurrence(plan, command.group.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
        command.group.groupKey,
        command,
      );
      if (new Set(command.enteredSlotKeys).size !== command.enteredSlotKeys.length) {
        failCommand(command, 'side-room entry order must contain distinct slots');
      }
      for (const slotKey of command.enteredSlotKeys) {
        if (!group.slots.some((slot) => slot.slotKey === slotKey)) {
          failCommand(command, `unknown side-room slot ${slotKey}`);
        }
        if (state.sideRooms[slotKey]?.generation !== 'generated') {
          failCommand(command, `${slotKey} must be generated before it can be entered`);
        }
      }
      const sideRooms = Object.fromEntries(
        Object.entries(state.sideRooms).map(([slotKey, sideRoom]) => {
          const index = command.enteredSlotKeys.indexOf(slotKey);
          return [slotKey, { ...sideRoom, enteredOrdinal: index < 0 ? null : index + 1 }];
        }),
      );
      if (
        Object.entries(state.sideRooms).every(
          ([slotKey, sideRoom]) => sideRoom.enteredOrdinal === sideRooms[slotKey]?.enteredOrdinal,
        )
      ) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(plan, { ...occurrence, state: { ...state, sideRooms } }, command),
      );
    }
    case 'ClearTopology':
      return plan.topology === null
        ? document
        : withBiome(document, located, { ...plan, topology: null });
    case 'ReplaceIncomingReward': {
      const occurrence = requireHubOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind === 'fixed') {
        const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
        if (
          room.incomingReward.kind !== 'fixed' ||
          command.value.rewardType !== room.incomingReward.offer.rewardType
        ) {
          failCommand(command, `${occurrence.gameName} has a fixed reward type`);
        }
        const current = {
          rewardType: room.incomingReward.offer.rewardType,
          ...(occurrence.state.payload === undefined
            ? room.incomingReward.offer.payload === undefined
              ? {}
              : { payload: room.incomingReward.offer.payload }
            : { payload: occurrence.state.payload }),
        };
        if (sameOffer(current, command.value)) {
          return document;
        }
        return withBiome(
          document,
          located,
          replaceHubOccurrence(
            plan,
            {
              ...occurrence,
              state: {
                kind: 'fixed',
                ...(command.value.payload === undefined ? {} : { payload: command.value.payload }),
              },
            },
            command,
          ),
        );
      }
      if (
        occurrence.state.kind !== 'counted' &&
        occurrence.state.kind !== 'freeReward' &&
        occurrence.state.kind !== 'ephyraCombat'
      ) {
        failCommand(command, `${occurrence.gameName} has no replaceable counted reward`);
      }
      if (sameOffer(occurrence.state.offer, command.value)) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          { ...occurrence, state: { ...occurrence.state, offer: command.value } },
          command,
        ),
      );
    }
    case 'ReplaceLocalReward': {
      const occurrence = requireHubOccurrence(plan, command.reward.occurrenceId, command);
      const { state, group } = requireEphyraSideGroup(
        occurrence,
        catalog,
        layout,
        command.reward.groupKey,
        command,
      );
      if (!group.slots.some((slot) => slot.slotKey === command.reward.slotKey)) {
        failCommand(command, `unknown side-room slot ${command.reward.slotKey}`);
      }
      const sideRoom = state.sideRooms[command.reward.slotKey];
      if (sideRoom === undefined) {
        failCommand(command, `missing side-room state ${command.reward.slotKey}`);
      }
      if (sameOffer(sideRoom.offer, command.value)) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              sideRooms: {
                ...state.sideRooms,
                [command.reward.slotKey]: { ...sideRoom, offer: command.value },
              },
            },
          },
          command,
        ),
      );
    }
    case 'ReplaceShopOffer':
    case 'SetShopPurchase': {
      const address = command.kind === 'ReplaceShopOffer' ? command.offer : command.purchase;
      const occurrence = requireHubOccurrence(plan, address.occurrenceId, command);
      if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) {
        failCommand(command, `${occurrence.gameName} has no materialized shop inventory`);
      }
      const offer = occurrence.state.shop.offers[address.offerKey];
      if (offer === undefined) {
        failCommand(command, `unknown shop offer ${address.offerKey}`);
      }
      if (command.kind === 'ReplaceShopOffer' && sameOffer(offer.offer, command.value)) {
        return document;
      }
      if (command.kind === 'SetShopPurchase') {
        if (typeof command.purchased !== 'boolean') {
          failCommand(command, 'purchased must be a boolean');
        }
        if (offer.purchased === command.purchased) {
          return document;
        }
      }
      const replacementOffer =
        command.kind === 'ReplaceShopOffer'
          ? { ...offer, offer: command.value }
          : { ...offer, purchased: command.purchased };
      return withBiome(
        document,
        located,
        replaceHubOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...occurrence.state,
              shop: {
                ...occurrence.state.shop,
                offers: {
                  ...occurrence.state.shop.offers,
                  [address.offerKey]: replacementOffer,
                },
              },
            },
          },
          command,
        ),
      );
    }
    default:
      failCommand(command, `${command.kind} is not available for HubBiome`);
  }
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
  if (layout.kind === 'HubBiome') {
    if (plan.kind !== 'HubBiome') {
      failCommand(command, `${layout.biomeKey} has no HubBiome plan`);
    }
    return applyHubUnchecked(document, catalog, located, plan, layout, command);
  }
  if (plan.kind !== 'LinearBiome') {
    failCommand(command, `${layout.biomeKey} has no LinearBiome plan`);
  }

  switch (command.kind) {
    case 'CreateHubTopology':
    case 'OpenHubSlot':
    case 'CloseHubSlot':
    case 'AppendHubVisit':
    case 'ReplaceHubVisit':
    case 'RemoveHubVisitsFrom':
    case 'ReplaceSideRoomGeneration':
    case 'ReplaceSideRoomEntryOrder':
      return failCommand(command, `${command.kind} requires HubBiome`);
    case 'ReplaceBiomeField': {
      const state = replaceBiomeStateField(
        plan.state,
        layout,
        command.field.fieldKey,
        command.value,
        `commands.ReplaceBiomeField.${command.field.fieldKey}`,
      );
      return state === plan.state ? document : withBiome(document, located, { ...plan, state });
    }
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
          roomStateContext(
            'ordinary',
            resolvedStoreForRoom(room, defaultSharedStore(layout)),
            true,
          ),
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
              rewardStore: defaultBatchRewardStore(layout, sourceRoom),
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
      const continuation = topology.continuations.find(
        (candidate) => candidate.parentOccurrenceId === command.rewardStore.parentOccurrenceId,
      );
      if (continuation === undefined || continuation.rewardStore?.kind !== 'authoredBaseStore') {
        failCommand(command, 'continuation does not expose an authored base store');
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
    case 'ReplaceFieldsCageOutcome': {
      if (layout.continuation.batchPolicy.kind !== 'fields') {
        failCommand(command, 'batch does not expose a Fields cage outcome');
      }
      if (command.cageOutcome !== 'min' && command.cageOutcome !== 'max') {
        failCommand(command, 'cageOutcome must be min or max');
      }
      const topology = requireTopology(plan, command);
      const continuation = requireContinuation(
        plan,
        command.continuation.parentOccurrenceId,
        'batch',
        command,
      );
      if (continuation.batchState?.cageOutcome === command.cageOutcome) {
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
                  batchState: Object.freeze({ cageOutcome: command.cageOutcome }),
                }
              : candidate,
          ),
        },
      });
    }
    case 'ReplaceShipEncounterCount': {
      const occurrence = requireOccurrence(plan, command.occurrence.occurrenceId, command);
      if (occurrence.state.kind !== 'shipCombat') {
        failCommand(command, `${occurrence.gameName} has no ShipCombat encounter count`);
      }
      if (command.encounterCount !== 2 && command.encounterCount !== 3) {
        failCommand(command, 'encounterCount must be 2 or 3');
      }
      if (occurrence.state.encounterCount === command.encounterCount) {
        return document;
      }
      return withBiome(
        document,
        located,
        replaceOccurrence(
          plan,
          {
            ...occurrence,
            state: { ...occurrence.state, encounterCount: command.encounterCount },
          },
          command,
        ),
      );
    }
    case 'ReplaceRewardWheelOfferCount':
    case 'ReplaceRewardWheelStore':
    case 'ReplaceRewardWheelPicked':
    case 'ReplaceRewardWheelOffer': {
      const address = command.kind === 'ReplaceRewardWheelOffer' ? command.offer : command.wheel;
      const { occurrence, state, descriptor } = requireRewardWheel(
        plan,
        catalog,
        layout,
        address,
        command,
      );
      const wheel = state.wheels[address.wheelKey];
      if (wheel === undefined) {
        failCommand(command, `${occurrence.gameName} lost wheel ${address.wheelKey}`);
      }
      let replacement: typeof wheel;
      if (command.kind === 'ReplaceRewardWheelOfferCount') {
        if (
          !Number.isInteger(command.offerCount) ||
          command.offerCount < descriptor.offerCount.min ||
          command.offerCount > descriptor.offerCount.max
        ) {
          failCommand(
            command,
            `offerCount must be between ${descriptor.offerCount.min} and ${descriptor.offerCount.max}`,
          );
        }
        if (wheel.offerCount === command.offerCount) {
          return document;
        }
        replacement = {
          ...wheel,
          offerCount: command.offerCount,
          pickedOfferIndex: Math.min(wheel.pickedOfferIndex, command.offerCount),
        };
      } else if (command.kind === 'ReplaceRewardWheelStore') {
        if (!descriptor.reward.storeKeys.includes(command.storeKey)) {
          failCommand(command, `${command.storeKey} is not available from ${address.wheelKey}`);
        }
        if (wheel.storeKey === command.storeKey) {
          return document;
        }
        replacement = { ...wheel, storeKey: command.storeKey };
      } else if (command.kind === 'ReplaceRewardWheelPicked') {
        if (
          !Number.isInteger(command.pickedOfferIndex) ||
          command.pickedOfferIndex < 1 ||
          command.pickedOfferIndex > wheel.offerCount
        ) {
          failCommand(command, 'pickedOfferIndex must address an active offer');
        }
        if (wheel.pickedOfferIndex === command.pickedOfferIndex) {
          return document;
        }
        replacement = { ...wheel, pickedOfferIndex: command.pickedOfferIndex };
      } else {
        if (!descriptor.offerKeys.includes(command.offer.offerKey)) {
          failCommand(command, `unknown wheel offer ${command.offer.offerKey}`);
        }
        const current = wheel.offers[command.offer.offerKey];
        if (current === undefined) {
          failCommand(command, `missing wheel offer ${command.offer.offerKey}`);
        }
        if (sameOffer(current, command.value)) {
          return document;
        }
        replacement = {
          ...wheel,
          offers: { ...wheel.offers, [command.offer.offerKey]: command.value },
        };
      }
      return withBiome(
        document,
        located,
        replaceOccurrence(
          plan,
          {
            ...occurrence,
            state: {
              ...state,
              wheels: { ...state.wheels, [address.wheelKey]: replacement },
            },
          },
          command,
        ),
      );
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
              rewardStore: defaultBatchRewardStore(layout, sourceRoom),
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
      const stages = stagedProgressionStages(layout);
      if (stages !== undefined && plan.topology !== null) {
        const owner = plan.topology.continuations.find((continuation) =>
          continuation.targets.some(
            (target) => target.occurrenceId === command.occurrence.occurrenceId,
          ),
        );
        if (owner?.kind === 'batch') {
          const stageIndex = stagedBatchIndex(plan.topology, owner.parentOccurrenceId);
          const stage = stageIndex === undefined ? undefined : stages[stageIndex];
          if (stage === undefined || !stagedRoomIsAvailable(stage, room.gameName)) {
            failCommand(command, `${room.gameName} is not available in stage ${stage?.key ?? '?'}`);
          }
        }
      }
      if (
        layout.terminal.kind === 'generatedTarget' &&
        room.gameName === layout.terminal.roomGameName &&
        plan.topology?.continuations.some(
          (continuation) => continuation.parentOccurrenceId === occurrence.occurrenceId,
        )
      ) {
        failCommand(
          command,
          'remove the downstream continuation before selecting the terminal room',
        );
      }
      const role = occurrenceRole(plan, catalog, layout, occurrence.occurrenceId, command, room);
      const replacement = {
        occurrenceId: occurrence.occurrenceId,
        gameName: room.gameName,
        state: createDefaultRoomState(
          catalog,
          room,
          roomStateContext(
            role,
            resolvedStoreForOccurrence(plan, catalog, layout, occurrence.occurrenceId, room),
            isOccurrenceEntered(plan, occurrence.occurrenceId),
          ),
        ),
      };
      const withReplacement = replaceOccurrence(plan, replacement, command);
      return withBiome(
        document,
        located,
        reconcileOwnedContinuationRewardStore(
          withReplacement,
          layout,
          occurrence.occurrenceId,
          room,
          command,
        ),
      );
    }
    case 'ReplaceIncomingReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind === 'fixed') {
        const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
        if (
          room.incomingReward.kind !== 'fixed' ||
          command.value.rewardType !== room.incomingReward.offer.rewardType
        ) {
          failCommand(command, `${occurrence.gameName} has a fixed reward type`);
        }
        const current = {
          rewardType: room.incomingReward.offer.rewardType,
          ...(occurrence.state.payload === undefined
            ? room.incomingReward.offer.payload === undefined
              ? {}
              : { payload: room.incomingReward.offer.payload }
            : { payload: occurrence.state.payload }),
        };
        if (sameOffer(current, command.value)) {
          return document;
        }
        const replacement = {
          ...occurrence,
          state: {
            kind: 'fixed' as const,
            ...(command.value.payload === undefined ? {} : { payload: command.value.payload }),
          },
        };
        return withBiome(document, located, replaceOccurrence(plan, replacement, command));
      }
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
    case 'ReplaceLocalReward': {
      const occurrence = requireOccurrence(plan, command.reward.occurrenceId, command);
      if (occurrence.state.kind !== 'fieldsCombat' || command.reward.groupKey !== 'cages') {
        failCommand(command, `${occurrence.gameName} has no replaceable local reward group`);
      }
      const room = requireRoom(catalog, occurrence.gameName, layout.biomeKey, command);
      const cages = room.localChildren.find((child) => child.key === command.reward.groupKey);
      if (
        cages?.kind !== 'boundedRewardSlots' ||
        !cages.slotKeys.includes(command.reward.slotKey)
      ) {
        failCommand(
          command,
          `unknown local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
        );
      }
      const offer = occurrence.state.cages[command.reward.slotKey];
      if (offer === undefined) {
        failCommand(
          command,
          `missing local reward ${command.reward.groupKey}.${command.reward.slotKey}`,
        );
      }
      if (sameOffer(offer, command.value)) {
        return document;
      }
      const replacement = {
        ...occurrence,
        state: {
          ...occurrence.state,
          cages: { ...occurrence.state.cages, [command.reward.slotKey]: command.value },
        },
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
