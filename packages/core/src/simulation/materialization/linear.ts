import type {
  Catalog,
  FixedEntryDescriptor,
  LinearBiomeLayout,
  RoomDeclaration,
  RoomTemplateKey,
} from '../../catalog';
import {
  createBatchRewardStoreAddress,
  createContinuationAddress,
  createFixedEntryRewardAddress,
  createFixedEntryRoomAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createPickedAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  type BiomeAddress,
} from '../../project/addresses';
import type {
  AuthoredRoomState,
  BatchRewardStoreState,
  LinearBatchContinuation,
  LinearBiomePlan,
  LinearBiomeTopology,
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
  ShopState,
} from '../../project/model';
import type { CompleteLinearCompletenessResult } from '../completeness';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBatchState,
  CanonicalBatchRewardStore,
  CanonicalFixedEntryRoom,
  CanonicalLinearBiome,
  CanonicalLocalReward,
  CanonicalPhysicalExit,
  CanonicalResolvedIncomingReward,
  CanonicalRoomReference,
  CanonicalShopEntryState,
  CanonicalTarget,
  CanonicalTargetContinuation,
  CanonicalTerminalEntry,
} from './model';
import { materializeCompletionRooms } from './completion';

type LinearAuthoredTemplateKey =
  | 'ClockworkCombat'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FieldsCombat'
  | 'ForkedPreboss'
  | 'Fountain'
  | 'Miniboss'
  | 'Shop'
  | 'ShopPreboss'
  | 'StandardCombat'
  | 'Story';

type AuthoredRoomRole = 'ordinary' | 'terminalFreeReward' | 'terminalShop';

interface AuthoredRoomMaterializationContext {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  readonly room: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  readonly role: AuthoredRoomRole;
  readonly entered: boolean;
  readonly batchStoreKey?: string;
  readonly activeCageCount?: number;
  readonly clockworkReward?: 'goal' | 'nonGoal';
}

interface MaterializedRoomLeaf {
  readonly lifecycleProfileKey: string;
  readonly encounterProfileKey?: string;
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly localRewards?: readonly CanonicalLocalReward[];
  readonly entryState?: CanonicalShopEntryState;
  readonly clockworkReward?: 'goal' | 'nonGoal';
}

type AuthoredTemplateMaterializer = (
  context: AuthoredRoomMaterializationContext,
) => MaterializedRoomLeaf;

export class LinearMaterializationContractError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'LinearMaterializationContractError';
  }
}

function fail(detail: string): never {
  throw new LinearMaterializationContractError(detail);
}

function resolvedStoreKey(
  room: RoomDeclaration,
  batchStoreKey: string | undefined,
): string | undefined {
  return room.forcedRewardStoreKey ?? room.individualRewardStoreKey ?? batchStoreKey;
}

function resolvedIncomingReward(
  context: AuthoredRoomMaterializationContext,
  producerKind: CanonicalResolvedIncomingReward['producerKind'],
  producerLifecycleKey: string,
  offer: CanonicalResolvedIncomingReward['offer'],
): CanonicalResolvedIncomingReward {
  const storeKey = resolvedStoreKey(context.room, context.batchStoreKey);
  return Object.freeze({
    origin: createIncomingRewardAddress(context.biome, context.occurrence.occurrenceId),
    kind: 'resolved',
    producerKind,
    producerLifecycleKey,
    offer,
    ...(storeKey === undefined ? {} : { resolvedStoreKey: storeKey }),
  });
}

function requireStateKind<Kind extends AuthoredRoomState['kind']>(
  context: AuthoredRoomMaterializationContext,
  kind: Kind,
): Extract<AuthoredRoomState, { readonly kind: Kind }> {
  if (context.occurrence.state.kind !== kind) {
    fail(
      `${context.occurrence.gameName} expected ${kind} state, received ${context.occurrence.state.kind}`,
    );
  }
  return context.occurrence.state as Extract<AuthoredRoomState, { readonly kind: Kind }>;
}

function materializeCountedRoom(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'counted');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'countedChoice') {
    fail(`${context.room.gameName} counted template has ${binding.kind} producer`);
  }
  return Object.freeze({
    lifecycleProfileKey: 'StandardRewardRoom',
    incomingReward: resolvedIncomingReward(
      context,
      'countedChoice',
      binding.producerLifecycleKey,
      state.offer,
    ),
  });
}

function materializeClockworkCombat(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  requireStateKind(context, 'counted');
  if (context.clockworkReward === undefined) {
    fail(`${context.room.gameName} has no derived Clockwork reward`);
  }
  if (context.clockworkReward === 'goal') {
    return Object.freeze({
      lifecycleProfileKey: 'ClockworkGoalRoom',
      clockworkReward: 'goal',
    });
  }
  return Object.freeze({
    ...materializeCountedRoom(context),
    clockworkReward: 'nonGoal',
  });
}

function materializeFixedRoom(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'fixed');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'fixed') {
    fail(`${context.room.gameName} fixed template has ${binding.kind} producer`);
  }
  const payload = state.payload ?? binding.offer.payload;
  return Object.freeze({
    lifecycleProfileKey: 'StandardRewardRoom',
    incomingReward: resolvedIncomingReward(
      context,
      'fixed',
      binding.producerLifecycleKey,
      Object.freeze({
        rewardType: binding.offer.rewardType,
        ...(payload === undefined ? {} : { payload }),
      }),
    ),
  });
}

function materializeRewardlessRoom(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  requireStateKind(context, 'none');
  if (context.room.incomingReward.kind !== 'none') {
    fail(`${context.room.gameName} rewardless template has a reward producer`);
  }
  return Object.freeze({ lifecycleProfileKey: 'RewardlessRoom' });
}

function fieldsEncounterProfileKey(
  catalog: Catalog,
  biomeKey: string,
  activeCageCount: number,
): string {
  const candidateKeys = new Set(
    catalog.rooms.values.flatMap((room) =>
      room.biomeKey === biomeKey &&
      room.mode.kind === 'authored' &&
      room.mode.templateKey === 'FieldsCombat'
        ? [room.encounterProfileKey]
        : [],
    ),
  );
  const matches = [...candidateKeys].filter((key) => {
    const profile = catalog.encounterProfiles.byKey[key];
    return (
      profile !== undefined &&
      profile.phases[0]?.key === 'Passive' &&
      profile.phases.filter((phase) => phase.countsEncounterDepth).length === activeCageCount
    );
  });
  if (matches.length !== 1 || matches[0] === undefined) {
    fail(`${biomeKey} has no unique Fields encounter profile for ${activeCageCount} cages`);
  }
  return matches[0];
}

function materializeFieldsCombat(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'fieldsCombat');
  const descriptor = context.room.localChildren[0];
  if (descriptor?.kind !== 'boundedRewardSlots' || descriptor.key !== 'cages') {
    fail(`${context.room.gameName} has no bounded cages descriptor`);
  }
  const activeCageCount = context.activeCageCount;
  if (
    activeCageCount === undefined ||
    !Number.isInteger(activeCageCount) ||
    activeCageCount <= 0 ||
    activeCageCount > descriptor.maxActiveSlots
  ) {
    fail(`${context.room.gameName} cannot activate ${String(activeCageCount)} cage rewards`);
  }
  const storeKey = context.room.individualRewardStoreKey;
  if (storeKey === undefined) {
    fail(`${context.room.gameName} has no Fields cage reward store`);
  }
  const encounterProfileKey = fieldsEncounterProfileKey(
    context.catalog,
    context.room.biomeKey,
    activeCageCount,
  );
  const encounter = context.catalog.encounterProfiles.byKey[encounterProfileKey];
  const cagePhases = encounter?.phases.filter((phase) => phase.countsEncounterDepth) ?? [];
  if (cagePhases.length !== activeCageCount) {
    fail(`${context.room.gameName} has no complete active cage encounter sequence`);
  }
  const localRewards = descriptor.slotKeys.slice(0, activeCageCount).map((slotKey, index) => {
    const offer = state.cages[slotKey];
    const encounterPhase = cagePhases[index];
    if (offer === undefined) {
      fail(`${context.room.gameName} is missing authored cage ${slotKey}`);
    }
    if (encounterPhase === undefined) {
      fail(`${context.room.gameName} is missing encounter phase for ${slotKey}`);
    }
    return Object.freeze({
      origin: createLocalRewardAddress(
        context.biome,
        context.occurrence.occurrenceId,
        descriptor.key,
        slotKey,
      ),
      groupKey: descriptor.key,
      slotKey,
      encounterPhaseKey: encounterPhase.key,
      producerLifecycleKey: descriptor.reward.producerLifecycleKey,
      offer,
      resolvedStoreKey: storeKey,
    });
  });
  return Object.freeze({
    lifecycleProfileKey: 'FieldsCombatRoom',
    encounterProfileKey,
    localRewards: Object.freeze(localRewards),
  });
}

function materializeShopEntry(
  context: AuthoredRoomMaterializationContext,
  shop: ShopState,
): CanonicalShopEntryState {
  const profile = context.catalog.rewards.shops.byKey[shop.profileKey];
  if (profile === undefined) {
    fail(`${context.room.gameName} references unknown shop profile ${shop.profileKey}`);
  }
  return Object.freeze({
    kind: 'shop',
    profileKey: profile.key,
    offers: Object.freeze(
      profile.slots.values.map((slot) => {
        const authored = shop.offers[slot.key];
        if (authored === undefined) {
          fail(`${context.room.gameName} shop is missing offer ${slot.key}`);
        }
        return Object.freeze({
          offerKey: slot.key,
          offerOrigin: createShopOfferAddress(
            context.biome,
            context.occurrence.occurrenceId,
            slot.key,
          ),
          purchaseOrigin: createShopPurchaseAddress(
            context.biome,
            context.occurrence.occurrenceId,
            slot.key,
          ),
          offer: authored.offer,
          purchased: authored.purchased,
        });
      }),
    ),
  });
}

function materializeShopRoom(
  context: AuthoredRoomMaterializationContext,
  lifecycleProfileKey: 'TerminalWorldShopRoom' | 'WorldShopRoom' = 'WorldShopRoom',
): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'shop');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'shop') {
    fail(`${context.room.gameName} shop template has ${binding.kind} producer`);
  }
  if (context.entered && state.shop === undefined) {
    fail(`${context.room.gameName} entered shop has no entry state`);
  }
  return Object.freeze({
    lifecycleProfileKey,
    incomingReward: resolvedIncomingReward(
      context,
      'shop',
      binding.producerLifecycleKey,
      binding.offer,
    ),
    ...(context.entered && state.shop !== undefined
      ? { entryState: materializeShopEntry(context, state.shop) }
      : {}),
  });
}

function materializeClockworkPreboss(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  if (context.role !== 'terminalShop' || context.clockworkReward !== 'goal') {
    fail(`${context.room.gameName} requires its generated Clockwork terminal role`);
  }
  return Object.freeze({
    ...materializeShopRoom(context, 'TerminalWorldShopRoom'),
    clockworkReward: 'goal',
  });
}

function materializeForkedPreboss(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  if (context.role === 'ordinary') {
    fail(`${context.room.gameName} forked preboss has no terminal role`);
  }
  if (context.role === 'terminalShop') {
    return materializeShopRoom(context, 'TerminalWorldShopRoom');
  }
  const state = requireStateKind(context, 'freeReward');
  const binding = context.room.entryOfferPolicy?.freeReward;
  if (binding === undefined) {
    fail(`${context.room.gameName} has no free-reward policy`);
  }
  return Object.freeze({
    lifecycleProfileKey: 'TerminalRewardRoom',
    incomingReward: resolvedIncomingReward(
      context,
      'freeReward',
      binding.producerLifecycleKey,
      state.offer,
    ),
  });
}

const authoredTemplateMaterializers = Object.freeze({
  ClockworkCombat: materializeClockworkCombat,
  FixedIntro: materializeRewardlessRoom,
  FixedOpening: materializeCountedRoom,
  FieldsCombat: materializeFieldsCombat,
  ForkedPreboss: materializeForkedPreboss,
  Fountain: materializeCountedRoom,
  Miniboss: materializeCountedRoom,
  Shop: materializeShopRoom,
  ShopPreboss: materializeClockworkPreboss,
  StandardCombat: materializeCountedRoom,
  Story: materializeFixedRoom,
}) satisfies Readonly<Record<LinearAuthoredTemplateKey, AuthoredTemplateMaterializer>>;

function authoredMaterializer(
  templateKey: RoomTemplateKey,
  roomGameName: string,
): AuthoredTemplateMaterializer {
  const materializer = (
    authoredTemplateMaterializers as Partial<
      Readonly<Record<RoomTemplateKey, AuthoredTemplateMaterializer>>
    >
  )[templateKey];
  if (materializer === undefined) {
    fail(`${roomGameName} uses unsupported linear template ${templateKey}`);
  }
  return materializer;
}

function requireLifecycleSelection(
  catalog: Catalog,
  room: RoomDeclaration,
  leaf: MaterializedRoomLeaf,
  encounterProfileKey: string,
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[leaf.lifecycleProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} selected unknown lifecycle ${leaf.lifecycleProfileKey}`);
  }
  if (!profile.encounterProfileKeys.includes(encounterProfileKey)) {
    fail(`${room.gameName} encounter ${encounterProfileKey} is incompatible with ${profile.key}`);
  }
  const producer = leaf.incomingReward;
  if (producer === undefined) {
    if (profile.producer.kind !== 'none') {
      fail(`${room.gameName} lifecycle ${profile.key} requires a producer`);
    }
  } else if (
    profile.producer.kind !== 'required' ||
    !profile.producer.lifecycleProfileKeys.includes(producer.producerLifecycleKey)
  ) {
    fail(
      `${room.gameName} producer ${producer.producerLifecycleKey} is incompatible with ${profile.key}`,
    );
  }
}

function encounterPhases(
  catalog: Catalog,
  room: RoomDeclaration,
  encounterProfileKey: string = room.encounterProfileKey,
) {
  const profile = catalog.encounterProfiles.byKey[encounterProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} references unknown encounter profile ${encounterProfileKey}`);
  }
  return profile.phases;
}

function materializeAuthoredRoom(
  context: AuthoredRoomMaterializationContext,
): CanonicalAuthoredRoom {
  if (context.room.mode.kind !== 'authored') {
    fail(`${context.room.gameName} is not an authored room`);
  }
  const leaf = authoredMaterializer(context.room.mode.templateKey, context.room.gameName)(context);
  const encounterProfileKey = leaf.encounterProfileKey ?? context.room.encounterProfileKey;
  const clockworkReward = leaf.clockworkReward ?? context.clockworkReward;
  requireLifecycleSelection(context.catalog, context.room, leaf, encounterProfileKey);
  return Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    encounterProfileKey,
    encounterPhases: encounterPhases(context.catalog, context.room, encounterProfileKey),
    lifecycleProfileKey: leaf.lifecycleProfileKey,
    counterEffects: context.room.counters,
    entered: context.entered,
    ...(context.room.requiredObjects === undefined
      ? {}
      : { requiredObjects: context.room.requiredObjects }),
    ...(leaf.incomingReward === undefined ? {} : { incomingReward: leaf.incomingReward }),
    ...(leaf.localRewards === undefined ? {} : { localRewards: leaf.localRewards }),
    ...(leaf.entryState === undefined ? {} : { entryState: leaf.entryState }),
    ...(clockworkReward === undefined ? {} : { clockworkReward }),
  });
}

function materializeFixedEntryRoom(
  catalog: Catalog,
  biome: BiomeAddress,
  descriptor: FixedEntryDescriptor,
): CanonicalFixedEntryRoom {
  const room = catalog.rooms.byKey[descriptor.roomGameName];
  if (
    room?.mode.kind !== 'derived' ||
    room.mode.classification !== 'fixedEntry' ||
    room.kind === 'Boss' ||
    room.kind === 'PostBoss'
  ) {
    fail(`${descriptor.roomGameName} is not a fixed-entry room`);
  }
  let lifecycleProfileKey: string;
  let incomingReward: CanonicalResolvedIncomingReward | undefined;
  if (room.incomingReward.kind === 'none') {
    lifecycleProfileKey = 'RewardlessRoom';
  } else if (room.incomingReward.kind === 'fixed') {
    lifecycleProfileKey = 'StandardRewardRoom';
    incomingReward = Object.freeze({
      origin: createFixedEntryRewardAddress(biome, descriptor.role),
      kind: 'resolved',
      producerKind: 'fixed',
      producerLifecycleKey: room.incomingReward.producerLifecycleKey,
      offer: room.incomingReward.offer,
      ...(room.forcedRewardStoreKey === undefined
        ? {}
        : { resolvedStoreKey: room.forcedRewardStoreKey }),
    });
  } else {
    fail(`${room.gameName} fixed entry has unsupported ${room.incomingReward.kind} producer`);
  }
  requireLifecycleSelection(
    catalog,
    room,
    { lifecycleProfileKey, ...(incomingReward === undefined ? {} : { incomingReward }) },
    room.encounterProfileKey,
  );
  return Object.freeze({
    kind: 'fixedEntry',
    origin: createFixedEntryRoomAddress(biome, descriptor.role),
    role: descriptor.role,
    gameName: room.gameName,
    encounterProfileKey: room.encounterProfileKey,
    encounterPhases: encounterPhases(catalog, room),
    lifecycleProfileKey,
    counterEffects: room.counters,
    entered: true,
    ...(incomingReward === undefined ? {} : { incomingReward }),
  });
}

function roomReference(
  room: CanonicalAuthoredRoom | CanonicalFixedEntryRoom,
): CanonicalRoomReference {
  return Object.freeze({
    origin: room.origin,
    ...(room.kind === 'authored' ? { occurrenceId: room.occurrenceId } : {}),
    gameName: room.gameName,
  });
}

function canonicalExit(room: RoomDeclaration, exitIndex: number): CanonicalPhysicalExit {
  const exit = room.exits.find((candidate) => candidate.index === exitIndex);
  if (exit === undefined) {
    return Object.freeze({ kind: 'unavailable', index: exitIndex });
  }
  return Object.freeze({
    kind: 'available',
    index: exit.index,
    type: exit.type,
    compatibilityPolicyKey: exit.compatibilityPolicyKey,
  });
}

function canonicalRewardStore(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId | null,
  state: BatchRewardStoreState,
): CanonicalBatchRewardStore {
  const origin = createBatchRewardStoreAddress(biome, parentOccurrenceId);
  switch (state.kind) {
    case 'authoredBaseStore':
      return Object.freeze({
        origin,
        kind: state.kind,
        baseRewardStoreKey: state.baseRewardStoreKey,
      });
    case 'sourceOfferPoint':
    case 'none':
      return Object.freeze({ origin, kind: state.kind });
  }
}

function requireOccurrence(
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  occurrenceId: OccurrenceId,
): RoomOccurrence {
  const occurrence = occurrences.get(occurrenceId);
  if (occurrence === undefined) {
    fail(`trusted topology lost occurrence ${occurrenceId}`);
  }
  return occurrence;
}

function requireRoom(catalog: Catalog, occurrence: RoomOccurrence): RoomDeclaration {
  const room = catalog.rooms.byKey[occurrence.gameName];
  if (room === undefined) {
    fail(`trusted topology lost room ${occurrence.gameName}`);
  }
  return room;
}

function finalSharedRewardStoreKey(
  catalog: Catalog,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  targets: LinearContinuation['targets'],
  initialStoreKey: string | undefined,
): string | undefined {
  let storeKey = initialStoreKey;
  for (const target of targets) {
    const occurrence = requireOccurrence(occurrences, target.occurrenceId);
    const room = requireRoom(catalog, occurrence);
    if (room.forcedRewardStoreKey !== undefined) {
      storeKey = room.forcedRewardStoreKey;
    }
  }
  return storeKey;
}

function canonicalBatchState(
  catalog: Catalog,
  layout: LinearBiomeLayout,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  continuation: LinearBatchContinuation,
): CanonicalBatchState {
  const policy = layout.continuation.batchPolicy;
  if (policy.kind === 'standard') {
    if (continuation.batchState !== null) {
      fail(`${layout.biomeKey} standard batch owns unexpected authored state`);
    }
    return Object.freeze({ kind: 'standard' });
  }
  if (policy.kind !== 'fields' || continuation.batchState === null) {
    fail(`${layout.biomeKey} does not expose a materializable batch state`);
  }
  let batchCapacity = policy.maxDoorCageRewards;
  let cageTargetCount = 0;
  for (const target of continuation.targets) {
    const occurrence = requireOccurrence(occurrences, target.occurrenceId);
    const room = requireRoom(catalog, occurrence);
    if (room.mode.kind !== 'authored' || room.mode.templateKey !== 'FieldsCombat') {
      continue;
    }
    const cages = room.localChildren[0];
    if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
      fail(`${room.gameName} has no Fields cage capacity`);
    }
    cageTargetCount += 1;
    batchCapacity = Math.min(batchCapacity, cages.maxActiveSlots);
  }
  const cageOutcome = continuation.batchState.cageOutcome;
  return Object.freeze({
    kind: 'fields',
    cageOutcome,
    batchCapacity,
    cageTargetCount,
    doorCageRewardCount: cageOutcome === 'min' ? policy.minDoorCageRewards : batchCapacity,
  });
}

export function projectLinearBatchState(
  catalog: Catalog,
  biome: BiomeAddress,
  topology: LinearBiomeTopology,
  continuation: LinearBatchContinuation,
): CanonicalBatchState {
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    fail(`${biome.biomeKey} is not a linear biome`);
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const owned = topology.continuations.find(
    (candidate) =>
      candidate.kind === 'batch' &&
      candidate.parentOccurrenceId === continuation.parentOccurrenceId,
  );
  if (owned === undefined || owned.kind !== 'batch') {
    fail(`batch ${continuation.parentOccurrenceId} does not belong to the supplied topology`);
  }
  return canonicalBatchState(
    catalog,
    layout,
    new Map(topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence])),
    owned,
  );
}

function requirePickedExit(continuation: LinearContinuation): number {
  if (continuation.pickedExitIndex === null) {
    fail(`complete continuation ${continuation.parentOccurrenceId} lost its pick`);
  }
  return continuation.pickedExitIndex;
}

function materializeTarget(
  catalog: Catalog,
  biome: BiomeAddress,
  occurrences: ReadonlyMap<OccurrenceId, RoomOccurrence>,
  parentRoom: RoomDeclaration,
  continuation: LinearContinuation,
  target: LinearContinuation['targets'][number],
  role: AuthoredRoomRole,
  effect: CanonicalTargetContinuation,
  batchStoreKey?: string,
  activeCageCount?: number,
  clockworkReward?: 'goal' | 'nonGoal',
): CanonicalTarget {
  const occurrence = requireOccurrence(occurrences, target.occurrenceId);
  const room = requireRoom(catalog, occurrence);
  const picked = continuation.pickedExitIndex === target.exitIndex;
  return Object.freeze({
    origin: createTargetAddress(biome, continuation.parentOccurrenceId, target.exitIndex),
    exit: canonicalExit(parentRoom, target.exitIndex),
    picked,
    continuation: picked ? effect : 'deadLeaf',
    room: materializeAuthoredRoom({
      catalog,
      biome,
      room,
      occurrence,
      role,
      entered: picked,
      ...(batchStoreKey === undefined ? {} : { batchStoreKey }),
      ...(activeCageCount === undefined ? {} : { activeCageCount }),
      ...(clockworkReward === undefined ? {} : { clockworkReward }),
    }),
  });
}

function requireLinearLayout(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteLinearCompletenessResult,
): LinearBiomeLayout {
  if ((completeness as { readonly completion?: unknown }).completion !== 'complete') {
    fail('linear materialization requires a complete biome result');
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  const supportedContinuation =
    layout?.kind === 'LinearBiome' &&
    ((layout.continuation.batchPolicy.kind === 'standard' &&
      layout.continuation.rewardStorePolicy.kind === 'authoredBaseStore') ||
      (layout.continuation.batchPolicy.kind === 'fields' &&
        layout.continuation.rewardStorePolicy.kind === 'none') ||
      (layout.continuation.batchPolicy.kind === 'clockwork' &&
        layout.continuation.rewardStorePolicy.kind === 'none'));
  const supportedEntry =
    layout?.kind === 'LinearBiome' &&
    ((layout.start.kind === 'authoredStart' && layout.entries.length === 0) ||
      (layout.start.kind === 'fixedEntry' &&
        layout.entries.every((entry) => entry.kind === 'fixedEntry')));
  const supportedTerminal =
    layout?.kind === 'LinearBiome' &&
    ((layout.terminal.kind === 'forkedTransition' &&
      layout.continuation.batchPolicy.kind !== 'clockwork') ||
      (layout.terminal.kind === 'generatedTarget' &&
        layout.continuation.batchPolicy.kind === 'clockwork'));
  const supportedFields =
    layout?.kind === 'LinearBiome' &&
    (layout.continuation.batchPolicy.kind === 'clockwork'
      ? layout.fields.length === 1 &&
        layout.fields[0]?.key === 'maxNonGoalRewards' &&
        layout.fields[0].kind === 'boundedInteger'
      : layout.fields.length === 0);
  if (
    layout?.kind !== 'LinearBiome' ||
    !supportedEntry ||
    !supportedContinuation ||
    layout.continuation.rewardStoreOverrides.length !== 0 ||
    !supportedTerminal ||
    !supportedFields
  ) {
    fail(`catalog ${biome.biomeKey} layout is not supported by the canonical linear materializer`);
  }
  for (const room of catalog.rooms.values) {
    if (room.biomeKey === layout.biomeKey && room.mode.kind === 'authored') {
      authoredMaterializer(room.mode.templateKey, room.gameName);
    }
  }
  return layout;
}

interface ClockworkProjectionState {
  readonly goalsRemaining: number;
  readonly nonGoalRewardsAcquired: number;
  readonly maxNonGoalRewards: number;
}

export interface ClockworkTargetProjection {
  readonly exitIndex: number;
  readonly occurrenceId: OccurrenceId;
  readonly reward: 'goal' | 'nonGoal';
}

export interface ClockworkBatchProjection {
  readonly parentOccurrenceId: OccurrenceId | null;
  readonly batchState: Extract<CanonicalBatchState, { readonly kind: 'clockwork' }>;
  readonly targets: readonly ClockworkTargetProjection[];
}

function clockworkBatchState(
  state: ClockworkProjectionState,
): Extract<CanonicalBatchState, { readonly kind: 'clockwork' }> {
  return Object.freeze({ kind: 'clockwork', ...state });
}

function clockworkReward(
  room: RoomDeclaration,
  state: ClockworkProjectionState,
  goalAlreadyOffered: boolean,
  terminalRoomGameName: string,
): 'goal' | 'nonGoal' {
  if (room.gameName === terminalRoomGameName) {
    return 'goal';
  }
  if (room.kind !== 'Combat') {
    return 'nonGoal';
  }
  return (state.goalsRemaining > 0 && !goalAlreadyOffered) ||
    state.nonGoalRewardsAcquired >= state.maxNonGoalRewards
    ? 'goal'
    : 'nonGoal';
}

function advanceClockworkState(
  state: ClockworkProjectionState,
  reward: 'goal' | 'nonGoal',
): ClockworkProjectionState {
  return reward === 'goal'
    ? Object.freeze({ ...state, goalsRemaining: Math.max(0, state.goalsRemaining - 1) })
    : Object.freeze({
        ...state,
        nonGoalRewardsAcquired: state.nonGoalRewardsAcquired + 1,
      });
}

function projectClockworkBatches(
  catalog: Catalog,
  layout: LinearBiomeLayout,
  topology: LinearBiomeTopology,
  maxNonGoalRewards: number,
): readonly ClockworkBatchProjection[] {
  if (
    layout.start.kind !== 'fixedEntry' ||
    layout.terminal.kind !== 'generatedTarget' ||
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    fail(`${layout.biomeKey} is not a Clockwork linear biome`);
  }
  let state: ClockworkProjectionState = Object.freeze({
    goalsRemaining: layout.continuation.batchPolicy.initialGoalCount,
    nonGoalRewardsAcquired: 0,
    maxNonGoalRewards,
  });
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const batches: ClockworkBatchProjection[] = [];
  for (const continuation of topology.continuations) {
    if (continuation.kind !== 'batch') {
      fail(`${layout.biomeKey} Clockwork topology contains an independent terminal transition`);
    }
    const batchState = clockworkBatchState(state);
    let goalAlreadyOffered = false;
    const targets = Object.freeze(
      [...continuation.targets]
        .sort((left, right) => left.exitIndex - right.exitIndex)
        .map((target): ClockworkTargetProjection => {
          const occurrence = requireOccurrence(occurrences, target.occurrenceId);
          const room = requireRoom(catalog, occurrence);
          const reward = clockworkReward(
            room,
            state,
            goalAlreadyOffered,
            layout.terminal.roomGameName,
          );
          if (reward === 'goal') {
            goalAlreadyOffered = true;
          }
          return Object.freeze({
            exitIndex: target.exitIndex,
            occurrenceId: target.occurrenceId,
            reward,
          });
        }),
    );
    batches.push(
      Object.freeze({
        parentOccurrenceId: continuation.parentOccurrenceId,
        batchState,
        targets,
      }),
    );
    const picked = targets.find((target) => target.exitIndex === continuation.pickedExitIndex);
    if (picked !== undefined) {
      state = advanceClockworkState(state, picked.reward);
    }
  }
  return Object.freeze(batches);
}

export function projectClockworkTopology(
  catalog: Catalog,
  biome: BiomeAddress,
  plan: LinearBiomePlan,
): readonly ClockworkBatchProjection[] {
  if (plan.biomeKey !== biome.biomeKey) {
    fail(`${biome.biomeKey} projection received ${plan.biomeKey} plan`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (layout?.kind !== 'LinearBiome') {
    fail(`${biome.biomeKey} is not a linear biome`);
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const maxNonGoalRewards = plan.state.maxNonGoalRewards;
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards)) {
    fail(`${layout.biomeKey} has no projectable maxNonGoalRewards`);
  }
  return plan.topology === null
    ? Object.freeze([])
    : projectClockworkBatches(catalog, layout, plan.topology, maxNonGoalRewards);
}

function materializeClockworkBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
  completeness: CompleteLinearCompletenessResult,
): CanonicalLinearBiome {
  if (
    layout.start.kind !== 'fixedEntry' ||
    layout.terminal.kind !== 'generatedTarget' ||
    layout.continuation.batchPolicy.kind !== 'clockwork'
  ) {
    fail(`${layout.biomeKey} is not a Clockwork linear biome`);
  }
  const maxNonGoalRewards = completeness.biomeState.maxNonGoalRewards;
  if (typeof maxNonGoalRewards !== 'number' || !Number.isInteger(maxNonGoalRewards)) {
    fail(`${layout.biomeKey} has no materializable maxNonGoalRewards`);
  }
  const entryDescriptors = [layout.start, ...layout.entries] as readonly FixedEntryDescriptor[];
  const entryRooms = Object.freeze(
    entryDescriptors.map((descriptor) => materializeFixedEntryRoom(catalog, biome, descriptor)),
  );
  const initialSource = entryRooms.at(-1);
  if (initialSource === undefined) {
    fail(`${layout.biomeKey} has no fixed entry source`);
  }
  let source: CanonicalAuthoredRoom | CanonicalFixedEntryRoom = initialSource;
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  const batches: CanonicalBatch[] = [];
  let terminalEntry: CanonicalTerminalEntry | undefined;
  const projectedBatches = projectClockworkBatches(catalog, layout, topology, maxNonGoalRewards);

  for (const [batchIndex, continuation] of topology.continuations.entries()) {
    if (continuation.kind !== 'batch') {
      fail(`${layout.biomeKey} Clockwork topology contains an independent terminal transition`);
    }
    const expectedParent = source.kind === 'fixedEntry' ? null : source.occurrenceId;
    if (continuation.parentOccurrenceId !== expectedParent) {
      fail(`Clockwork batch ${batchIndex + 1} is disconnected from ${source.gameName}`);
    }
    const sourceDeclaration: RoomDeclaration | undefined = catalog.rooms.byKey[source.gameName];
    if (sourceDeclaration === undefined) {
      fail(`trusted Clockwork source lost room ${source.gameName}`);
    }
    const pickedExitIndex = requirePickedExit(continuation);
    const projectedBatch = projectedBatches[batchIndex];
    if (projectedBatch === undefined) {
      fail(`Clockwork batch ${batchIndex + 1} has no projection`);
    }
    const batchState = projectedBatch.batchState;
    const targets: readonly CanonicalTarget[] = Object.freeze(
      [...continuation.targets]
        .sort((left, right) => left.exitIndex - right.exitIndex)
        .map((target): CanonicalTarget => {
          const occurrence = requireOccurrence(occurrences, target.occurrenceId);
          const room = requireRoom(catalog, occurrence);
          const reward = projectedBatch.targets.find(
            (candidate) => candidate.exitIndex === target.exitIndex,
          )?.reward;
          if (reward === undefined) {
            fail(`Clockwork batch ${batchIndex + 1} target ${target.exitIndex} has no projection`);
          }
          const terminal = room.gameName === layout.terminal.roomGameName;
          return materializeTarget(
            catalog,
            biome,
            occurrences,
            sourceDeclaration,
            continuation,
            target,
            terminal ? 'terminalShop' : 'ordinary',
            terminal ? 'entersTerminal' : 'continuesSpine',
            undefined,
            undefined,
            reward,
          );
        }),
    );
    const picked: CanonicalTarget | undefined = targets.find(
      (target) => target.exit.index === pickedExitIndex,
    );
    if (picked === undefined) {
      fail(`Clockwork batch ${batchIndex + 1} lost its picked target`);
    }
    const rewardStore = canonicalRewardStore(biome, continuation.parentOccurrenceId, {
      kind: 'none',
    });
    if (picked.room.gameName === layout.terminal.roomGameName) {
      terminalEntry = Object.freeze({
        origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
        predecessor: roomReference(source),
        targets,
        pickedExitIndex,
        pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
        rewardStore,
        batchState,
      });
      break;
    }
    batches.push(
      Object.freeze({
        origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
        parent: roomReference(source),
        rewardStore,
        batchState,
        targets,
        pickedExitIndex,
        pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
      }),
    );
    source = picked.room;
  }

  if (terminalEntry === undefined) {
    fail(`complete ${layout.biomeKey} Clockwork topology has no picked terminal target`);
  }
  const terminalDeclaration = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalDeclaration === undefined) {
    fail(`${layout.terminal.roomGameName} has no terminal declaration`);
  }
  return Object.freeze({
    kind: 'LinearBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms,
    batches: Object.freeze(batches),
    terminalEntry,
    completionRooms: materializeCompletionRooms({
      catalog,
      biome,
      completion: layout.completion,
      enteredStorePolicy: {
        kind: 'declared',
        ...(terminalDeclaration.forcedRewardStoreKey === undefined
          ? {}
          : { resolvedOfferStoreKey: terminalDeclaration.forcedRewardStoreKey }),
      },
      lifecycleProducerPolicy: 'encounterCompatible',
      fail,
    }),
    biomeState: Object.freeze({ ...completeness.biomeState }),
  });
}

export function materializeLinearBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteLinearCompletenessResult,
): CanonicalLinearBiome {
  const layout = requireLinearLayout(catalog, biome, completeness);
  if (layout.continuation.batchPolicy.kind === 'clockwork') {
    return materializeClockworkBiome(catalog, biome, layout, completeness);
  }
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
  if (topology.startOccurrenceId === null) {
    fail(`${layout.biomeKey} derived entry materialization is not implemented`);
  }
  const startOccurrence = requireOccurrence(occurrences, topology.startOccurrenceId);
  const startRoom = requireRoom(catalog, startOccurrence);
  const canonicalByOccurrence = new Map<OccurrenceId, CanonicalAuthoredRoom>();
  const start = materializeAuthoredRoom({
    catalog,
    biome,
    room: startRoom,
    occurrence: startOccurrence,
    role: 'ordinary',
    entered: true,
  });
  canonicalByOccurrence.set(start.occurrenceId, start);

  const batches: CanonicalBatch[] = [];
  let terminalEntry: CanonicalTerminalEntry | undefined;
  for (const continuation of topology.continuations) {
    if (continuation.parentOccurrenceId === null) {
      fail(`${layout.biomeKey} derived entry continuation is not implemented`);
    }
    const parent = canonicalByOccurrence.get(continuation.parentOccurrenceId);
    if (parent === undefined) {
      fail(
        `continuation parent ${continuation.parentOccurrenceId} is not on the materialized spine`,
      );
    }
    const parentOccurrence = requireOccurrence(occurrences, continuation.parentOccurrenceId);
    const parentRoom = requireRoom(catalog, parentOccurrence);
    const pickedExitIndex = requirePickedExit(continuation);

    if (continuation.kind === 'batch') {
      const batchState = canonicalBatchState(catalog, layout, occurrences, continuation);
      const baseStoreKey =
        continuation.rewardStore.kind === 'authoredBaseStore'
          ? continuation.rewardStore.baseRewardStoreKey
          : undefined;
      const sharedStoreKey = finalSharedRewardStoreKey(
        catalog,
        occurrences,
        continuation.targets,
        baseStoreKey,
      );
      const targets = Object.freeze(
        continuation.targets.map((target) =>
          materializeTarget(
            catalog,
            biome,
            occurrences,
            parentRoom,
            continuation,
            target,
            'ordinary',
            'continuesSpine',
            sharedStoreKey,
            batchState.kind === 'fields' ? batchState.doorCageRewardCount : undefined,
          ),
        ),
      );
      for (const target of targets) {
        canonicalByOccurrence.set(target.room.occurrenceId, target.room);
      }
      batches.push(
        Object.freeze({
          origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
          parent: roomReference(parent),
          rewardStore: canonicalRewardStore(
            biome,
            continuation.parentOccurrenceId,
            continuation.rewardStore,
          ),
          batchState,
          targets,
          pickedExitIndex,
          pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
        }),
      );
      continue;
    }

    const targets = Object.freeze(
      continuation.targets.map((target) =>
        materializeTarget(
          catalog,
          biome,
          occurrences,
          parentRoom,
          continuation,
          target,
          target.exitIndex === 1 ? 'terminalShop' : 'terminalFreeReward',
          'entersTerminal',
        ),
      ),
    );
    terminalEntry = Object.freeze({
      origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
      predecessor: roomReference(parent),
      targets,
      pickedExitIndex,
      pickedOrigin: createPickedAddress(biome, continuation.parentOccurrenceId),
    });
  }

  if (terminalEntry === undefined) {
    fail(`complete ${layout.biomeKey} topology has no terminal entry`);
  }
  const terminalDeclaration = catalog.rooms.byKey[layout.terminal.roomGameName];
  if (terminalDeclaration === undefined) {
    fail(`${layout.terminal.roomGameName} has no terminal declaration`);
  }
  return Object.freeze({
    kind: 'LinearBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms: Object.freeze([start]),
    batches: Object.freeze(batches),
    terminalEntry,
    completionRooms: materializeCompletionRooms({
      catalog,
      biome,
      completion: layout.completion,
      enteredStorePolicy: {
        kind: 'declared',
        ...(terminalDeclaration.forcedRewardStoreKey === undefined
          ? {}
          : { resolvedOfferStoreKey: terminalDeclaration.forcedRewardStoreKey }),
      },
      lifecycleProducerPolicy: 'encounterCompatible',
      fail,
    }),
    biomeState: Object.freeze({ ...completeness.biomeState }),
  });
}
