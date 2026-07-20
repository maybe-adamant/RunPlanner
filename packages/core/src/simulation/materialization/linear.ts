import type { Catalog, LinearBiomeLayout, RoomDeclaration, RoomTemplateKey } from '../../catalog';
import {
  createBatchRewardStoreAddress,
  createCompletionRoomAddress,
  createContinuationAddress,
  createIncomingRewardAddress,
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
  LinearContinuation,
  OccurrenceId,
  RoomOccurrence,
  ShopState,
} from '../../project/model';
import type { CompleteFCompletenessResult } from '../completeness';
import type {
  CanonicalAuthoredRoom,
  CanonicalBatch,
  CanonicalBatchRewardStore,
  CanonicalCompletionRoom,
  CanonicalLinearBiome,
  CanonicalPhysicalExit,
  CanonicalResolvedIncomingReward,
  CanonicalRoomReference,
  CanonicalShopEntryState,
  CanonicalTarget,
  CanonicalTargetContinuation,
  CanonicalTerminalEntry,
} from './model';

type FAuthoredTemplateKey =
  'FixedOpening' | 'ForkedPreboss' | 'Fountain' | 'Miniboss' | 'Shop' | 'StandardCombat' | 'Story';

type AuthoredRoomRole = 'ordinary' | 'terminalFreeReward' | 'terminalShop';

interface AuthoredRoomMaterializationContext {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  readonly room: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  readonly role: AuthoredRoomRole;
  readonly entered: boolean;
  readonly batchStoreKey?: string;
}

interface MaterializedRoomLeaf {
  readonly lifecycleProfileKey: string;
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly entryState?: CanonicalShopEntryState;
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
  FixedOpening: materializeCountedRoom,
  ForkedPreboss: materializeForkedPreboss,
  Fountain: materializeCountedRoom,
  Miniboss: materializeCountedRoom,
  Shop: materializeShopRoom,
  StandardCombat: materializeCountedRoom,
  Story: materializeFixedRoom,
}) satisfies Readonly<Record<FAuthoredTemplateKey, AuthoredTemplateMaterializer>>;

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
    fail(`${roomGameName} uses unsupported F template ${templateKey}`);
  }
  return materializer;
}

function requireLifecycleSelection(
  catalog: Catalog,
  room: RoomDeclaration,
  leaf: MaterializedRoomLeaf,
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[leaf.lifecycleProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} selected unknown lifecycle ${leaf.lifecycleProfileKey}`);
  }
  if (!profile.encounterProfileKeys.includes(room.encounterProfileKey)) {
    fail(
      `${room.gameName} encounter ${room.encounterProfileKey} is incompatible with ${profile.key}`,
    );
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

function encounterPhases(catalog: Catalog, room: RoomDeclaration) {
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} references unknown encounter profile ${room.encounterProfileKey}`);
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
  requireLifecycleSelection(context.catalog, context.room, leaf);
  return Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    encounterProfileKey: context.room.encounterProfileKey,
    encounterPhases: encounterPhases(context.catalog, context.room),
    lifecycleProfileKey: leaf.lifecycleProfileKey,
    counterEffects: context.room.counters,
    entered: context.entered,
    ...(leaf.incomingReward === undefined ? {} : { incomingReward: leaf.incomingReward }),
    ...(leaf.entryState === undefined ? {} : { entryState: leaf.entryState }),
  });
}

function roomReference(room: CanonicalAuthoredRoom): CanonicalRoomReference {
  return Object.freeze({
    origin: room.origin,
    occurrenceId: room.occurrenceId,
    gameName: room.gameName,
  });
}

function canonicalExit(room: RoomDeclaration, exitIndex: number): CanonicalPhysicalExit {
  const exit = room.exits.find((candidate) => candidate.index === exitIndex);
  if (exit === undefined) {
    fail(`${room.gameName} has no physical exit ${exitIndex}`);
  }
  return Object.freeze({
    index: exit.index,
    type: exit.type,
    compatibilityPolicyKey: exit.compatibilityPolicyKey,
  });
}

function canonicalRewardStore(
  biome: BiomeAddress,
  parentOccurrenceId: OccurrenceId,
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
    }),
  });
}

function requireFLayout(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteFCompletenessResult,
): LinearBiomeLayout {
  if ((completeness as { readonly completion?: unknown }).completion !== 'complete') {
    fail('linear materialization requires a complete biome result');
  }
  if (biome.biomeKey !== 'F') {
    fail(`F materialization cannot process biome ${biome.biomeKey}`);
  }
  const route = catalog.routes.byKey[biome.routeKey];
  if (route === undefined || !route.biomeKeys.includes(biome.biomeKey)) {
    fail(`${biome.routeKey} does not place biome ${biome.biomeKey}`);
  }
  const layout = catalog.biomeLayouts.byKey[biome.biomeKey];
  if (
    layout?.kind !== 'LinearBiome' ||
    layout.start.kind !== 'authoredStart' ||
    layout.entries.length !== 0 ||
    layout.continuation.batchPolicy.kind !== 'standard' ||
    layout.continuation.rewardStorePolicy.kind !== 'authoredBaseStore' ||
    layout.continuation.rewardStoreOverrides.length !== 0 ||
    layout.terminal.kind !== 'forkedTransition' ||
    layout.fields.length !== 0
  ) {
    fail('catalog F layout is not supported by the canonical linear materializer');
  }
  for (const room of catalog.rooms.values) {
    if (room.biomeKey === layout.biomeKey && room.mode.kind === 'authored') {
      authoredMaterializer(room.mode.templateKey, room.gameName);
    }
  }
  return layout;
}

function materializeCompletionRooms(
  catalog: Catalog,
  biome: BiomeAddress,
  layout: LinearBiomeLayout,
): readonly CanonicalCompletionRoom[] {
  const completionKinds = {
    boss: { roomKind: 'Boss', lifecycleProfileKey: 'BossRoom' },
    postboss: { roomKind: 'PostBoss', lifecycleProfileKey: 'PostBossRoom' },
  } as const;
  return Object.freeze(
    layout.completion.rooms.map((descriptor): CanonicalCompletionRoom => {
      const room = catalog.rooms.byKey[descriptor.roomGameName];
      const expected = completionKinds[descriptor.role];
      if (
        room?.mode.kind !== 'derived' ||
        room.mode.classification !== 'completion' ||
        room.kind !== expected.roomKind ||
        room.incomingReward.kind !== 'none'
      ) {
        fail(`${descriptor.roomGameName} is not a supported ${descriptor.role} completion room`);
      }
      const lifecycleProfileKey = expected.lifecycleProfileKey;
      const profile = catalog.roomLifecycleProfiles.byKey[lifecycleProfileKey];
      if (
        profile === undefined ||
        !profile.encounterProfileKeys.includes(room.encounterProfileKey)
      ) {
        fail(`${room.gameName} cannot use lifecycle ${lifecycleProfileKey}`);
      }
      return Object.freeze({
        kind: 'completion',
        origin: createCompletionRoomAddress(biome, descriptor.role),
        role: descriptor.role,
        gameName: room.gameName,
        encounterProfileKey: room.encounterProfileKey,
        encounterPhases: encounterPhases(catalog, room),
        lifecycleProfileKey,
        counterEffects: room.counters,
        entered: true,
      });
    }),
  );
}

export function materializeLinearBiome(
  catalog: Catalog,
  biome: BiomeAddress,
  completeness: CompleteFCompletenessResult,
): CanonicalLinearBiome {
  const layout = requireFLayout(catalog, biome, completeness);
  const topology = completeness.topology;
  const occurrences = new Map(
    topology.occurrences.map((occurrence) => [occurrence.occurrenceId, occurrence]),
  );
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
      const baseStoreKey =
        continuation.rewardStore.kind === 'authoredBaseStore'
          ? continuation.rewardStore.baseRewardStoreKey
          : undefined;
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
            baseStoreKey,
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
          batchState: continuation.batchState,
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
    fail('complete F topology has no terminal entry');
  }
  return Object.freeze({
    kind: 'LinearBiome',
    routeKey: biome.routeKey,
    biomeKey: layout.biomeKey,
    entryRooms: Object.freeze([start]),
    batches: Object.freeze(batches),
    terminalEntry,
    completionRooms: materializeCompletionRooms(catalog, biome, layout),
    biomeState: Object.freeze({}),
  });
}
