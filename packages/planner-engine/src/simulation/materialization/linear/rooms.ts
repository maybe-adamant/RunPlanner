import {
  createFixedEntryRewardAddress,
  createFixedEntryRoomAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  type BiomeAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRoomState, RoomOccurrence, ShopState } from '../../../authored-project/model';
import type {
  Catalog,
  EncounterPhase,
  FixedEntryDescriptor,
  RoomDeclaration,
  RoomTemplateKey,
} from '../../../catalog-schema';
import type {
  CanonicalAuthoredRoom,
  CanonicalFixedEntryRoom,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalShopEntryState,
} from '../model';

import { fail } from './contract';

type LinearAuthoredTemplateKey =
  | 'ClockworkCombat'
  | 'Devotion'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FieldsCombat'
  | 'ForkedPreboss'
  | 'Fountain'
  | 'Miniboss'
  | 'RewardlessCombat'
  | 'Shop'
  | 'ShopPreboss'
  | 'ShipCombat'
  | 'StandardCombat'
  | 'Story';

export type AuthoredRoomRole = 'ordinary' | 'terminalFreeReward' | 'terminalShop';

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
  readonly encounterPhases?: readonly EncounterPhase[];
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly localRewards?: readonly CanonicalLocalReward[];
  readonly rewardWheels?: readonly CanonicalRewardWheel[];
  readonly entryState?: CanonicalShopEntryState;
  readonly clockworkReward?: 'goal' | 'nonGoal';
}

export interface MaterializedShipCombatState {
  readonly encounterPhases: readonly EncounterPhase[];
  readonly rewardWheels: readonly CanonicalRewardWheel[];
}

type AuthoredTemplateMaterializer = (
  context: AuthoredRoomMaterializationContext,
) => MaterializedRoomLeaf;

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

function materializeDevotion(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  return Object.freeze({
    ...materializeFixedRoom(context),
    lifecycleProfileKey: 'DevotionRoom',
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

export function materializeShipCombatState(
  catalog: Catalog,
  biome: BiomeAddress,
  room: RoomDeclaration,
  occurrence: RoomOccurrence,
): MaterializedShipCombatState {
  if (occurrence.state.kind !== 'shipCombat') {
    fail(`${occurrence.gameName} expected shipCombat state, received ${occurrence.state.kind}`);
  }
  const state = occurrence.state;
  const profile = catalog.encounterProfiles.byKey[room.encounterProfileKey];
  if (profile === undefined || profile.key !== 'ShipCombat') {
    fail(`${room.gameName} has no ShipCombat encounter profile`);
  }
  const encounterPhases = profile.phases.slice(0, state.encounterCount);
  if (
    encounterPhases.length !== state.encounterCount ||
    encounterPhases[0]?.key !== 'Intro' ||
    encounterPhases[1]?.offerPoint?.key !== 'wheel1' ||
    (state.encounterCount === 3 && encounterPhases[2]?.offerPoint?.key !== 'wheel2')
  ) {
    fail(`${room.gameName} cannot materialize ${state.encounterCount} encounters`);
  }
  const rewardWheels: CanonicalRewardWheel[] = encounterPhases.flatMap((phase) => {
    const descriptor = phase.offerPoint;
    if (descriptor === undefined) {
      return [];
    }
    const wheel = state.wheels[descriptor.key];
    if (wheel === undefined) {
      fail(`${room.gameName} is missing ${descriptor.key}`);
    }
    const offers = descriptor.offerKeys.slice(0, wheel.offerCount).map((offerKey, index) => {
      const offer = wheel.offers[offerKey];
      if (offer === undefined) {
        fail(`${room.gameName}.${descriptor.key} is missing ${offerKey}`);
      }
      return Object.freeze({
        origin: createRewardWheelOfferAddress(
          biome,
          occurrence.occurrenceId,
          descriptor.key,
          offerKey,
        ),
        offerKey,
        offer,
        picked: wheel.pickedOfferIndex === index + 1,
      });
    });
    if (offers.filter((offer) => offer.picked).length !== 1) {
      fail(`${room.gameName}.${descriptor.key} has no unique active pick`);
    }
    return [
      Object.freeze({
        origin: createRewardWheelAddress(biome, occurrence.occurrenceId, descriptor.key),
        wheelKey: descriptor.key,
        encounterPhaseKey: phase.key,
        producerLifecycleKey: descriptor.reward.producerLifecycleKey,
        storeKey: wheel.storeKey,
        offers: Object.freeze(offers),
        pickedOfferIndex: wheel.pickedOfferIndex,
      }),
    ];
  });
  return Object.freeze({
    encounterPhases: Object.freeze(encounterPhases),
    rewardWheels: Object.freeze(rewardWheels),
  });
}

function materializeShipCombat(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  const ship = materializeShipCombatState(
    context.catalog,
    context.biome,
    context.room,
    context.occurrence,
  );
  return Object.freeze({
    lifecycleProfileKey: 'ShipCombatRoom',
    encounterProfileKey: 'ShipCombat',
    encounterPhases: ship.encounterPhases,
    rewardWheels: ship.rewardWheels,
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

function materializeShopPreboss(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  if (
    context.role !== 'terminalShop' ||
    (context.clockworkReward !== undefined && context.clockworkReward !== 'goal')
  ) {
    fail(`${context.room.gameName} requires its terminal shop role`);
  }
  return Object.freeze({
    ...materializeShopRoom(context, 'TerminalWorldShopRoom'),
    ...(context.clockworkReward === undefined ? {} : { clockworkReward: 'goal' as const }),
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
  Devotion: materializeDevotion,
  FixedIntro: materializeRewardlessRoom,
  FixedOpening: materializeCountedRoom,
  FieldsCombat: materializeFieldsCombat,
  ForkedPreboss: materializeForkedPreboss,
  Fountain: materializeCountedRoom,
  Miniboss: materializeCountedRoom,
  RewardlessCombat: (context) =>
    Object.freeze({
      ...materializeRewardlessRoom(context),
      lifecycleProfileKey: 'RewardlessCombatRoom',
    }),
  Shop: materializeShopRoom,
  ShopPreboss: materializeShopPreboss,
  ShipCombat: materializeShipCombat,
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

export function assertAuthoredRoomTemplateSupported(
  templateKey: RoomTemplateKey,
  roomGameName: string,
): void {
  authoredMaterializer(templateKey, roomGameName);
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

export function materializeAuthoredRoom(
  context: AuthoredRoomMaterializationContext,
): CanonicalAuthoredRoom {
  if (context.room.mode.kind !== 'authored') {
    fail(`${context.room.gameName} is not an authored room`);
  }
  const leaf = authoredMaterializer(context.room.mode.templateKey, context.room.gameName)(context);
  const encounterProfileKey = leaf.encounterProfileKey ?? context.room.encounterProfileKey;
  const selectedEncounterPhases =
    leaf.encounterPhases ?? encounterPhases(context.catalog, context.room, encounterProfileKey);
  const clockworkReward = leaf.clockworkReward ?? context.clockworkReward;
  requireLifecycleSelection(context.catalog, context.room, leaf, encounterProfileKey);
  return Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    encounterProfileKey,
    encounterPhases: selectedEncounterPhases,
    lifecycleProfileKey: leaf.lifecycleProfileKey,
    counterEffects: context.room.counters,
    entered: context.entered,
    ...(context.room.requiredObjects === undefined
      ? {}
      : { requiredObjects: context.room.requiredObjects }),
    ...(leaf.incomingReward === undefined ? {} : { incomingReward: leaf.incomingReward }),
    ...(leaf.localRewards === undefined ? {} : { localRewards: leaf.localRewards }),
    ...(leaf.rewardWheels === undefined ? {} : { rewardWheels: leaf.rewardWheels }),
    ...(leaf.entryState === undefined ? {} : { entryState: leaf.entryState }),
    ...(clockworkReward === undefined ? {} : { clockworkReward }),
  });
}

export function materializeFixedEntryRoom(
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
