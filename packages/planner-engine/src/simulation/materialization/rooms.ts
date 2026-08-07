import {
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  createShopPurchaseAddress,
  type BiomeAddress,
} from '../../authored-project/addresses';
import type { AuthoredRoomState, RoomOccurrence, ShopState } from '../../authored-project/model';
import type { Catalog, RoomDeclaration, RoomTemplateKey } from '../../catalog-schema';
import { encounterEnvelopeSlots } from '../../authored-project/room-state/encounters';
import { alwaysActiveEncounterSlotKeys, resolveEncounterPhases } from '../encounters';
import type { ResolvedEncounterPhase } from '../encounters';
import type {
  CanonicalAuthoredRoom,
  CanonicalLocalReward,
  CanonicalResolvedIncomingReward,
  CanonicalRewardWheel,
  CanonicalShopEntryState,
} from './model';
import type { TraitMaterializationContext, TraitOfferContext } from '../traits';
import type { ResolvedRewardOffer } from '../../reward-kernel/model';

function fail(detail: string): never {
  throw new Error(detail);
}

type AuthoredTemplateKey =
  | 'Anomaly'
  | 'Chaos'
  | 'ClockworkCombat'
  | 'ContractBoss'
  | 'Devotion'
  | 'EphyraCombat'
  | 'FixedIntro'
  | 'FixedOpening'
  | 'FixedPreHub'
  | 'FieldsCombat'
  | 'Fountain'
  | 'Miniboss'
  | 'RewardlessCombat'
  | 'Shop'
  | 'Preboss'
  | 'ShipCombat'
  | 'StandardCombat'
  | 'Story';

export type AuthoredRoomRole = 'ordinary' | 'prebossFreeReward' | 'prebossShop';

export interface AuthoredRoomMaterializationContext {
  readonly catalog: Catalog;
  readonly biome: BiomeAddress;
  readonly room: RoomDeclaration;
  readonly occurrence: RoomOccurrence;
  readonly role: AuthoredRoomRole;
  readonly entered: boolean;
  readonly batchStoreKey?: string;
  readonly activeCageCount?: number;
  readonly clockworkReward?: 'goal' | 'nonGoal';
  readonly lifecycleProfileKey?: string;
  readonly traitContext?: TraitMaterializationContext;
}

interface MaterializedRoomLeaf {
  readonly lifecycleProfileKey: string;
  readonly activeEncounterSlotKeys?: readonly string[];
  readonly encounterPhases?: readonly ResolvedEncounterPhase[];
  readonly incomingReward?: CanonicalResolvedIncomingReward;
  readonly localRewards?: readonly CanonicalLocalReward[];
  readonly rewardWheels?: readonly CanonicalRewardWheel[];
  readonly entryState?: CanonicalShopEntryState;
  readonly clockworkReward?: 'goal' | 'nonGoal';
}

export interface MaterializedShipCombatState {
  readonly encounterPhases: readonly ResolvedEncounterPhase[];
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

function traitContextForOffer(
  context: AuthoredRoomMaterializationContext,
  offer: ResolvedRewardOffer,
): TraitOfferContext {
  return Object.freeze({
    ...(context.traitContext ?? {}),
    blockGiftBoons: context.room.blockGiftBoons,
    devotionNoDuo: offer.rewardType === 'Devotion',
  });
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
    ...('reward' in context.occurrence.state
      ? {
          traitOffersByAcquisitionRole:
            context.occurrence.state.reward.traitOffersByAcquisitionRole,
        }
      : {}),
    traitContext: traitContextForOffer(context, offer),
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
    lifecycleProfileKey:
      context.lifecycleProfileKey ??
      (context.room.encounterEnvelopeKey === 'PEncounter' ? 'PCombatRoom' : 'StandardRewardRoom'),
    incomingReward: resolvedIncomingReward(
      context,
      'countedChoice',
      binding.producerLifecycleKey,
      state.reward.offer,
    ),
  });
}

/**
 * Anomaly takes over an already-authored normal target. Its retained offer is
 * still consumed when the replacement is created, but failure deliberately
 * suppresses the later producer acquisition rather than rerolling or
 * refunding that authored offer.
 */
function materializeAnomaly(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'anomaly');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'countedChoice') {
    fail(`${context.room.gameName} Anomaly has ${binding.kind} producer`);
  }
  const incoming = resolvedIncomingReward(
    context,
    'countedChoice',
    binding.producerLifecycleKey,
    state.reward.offer,
  );
  return Object.freeze({
    lifecycleProfileKey: 'StandardRewardRoom',
    incomingReward: Object.freeze({ ...incoming, acquisitionEnabled: state.success }),
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

function materializeEphyraCombat(
  context: AuthoredRoomMaterializationContext,
): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'ephyraCombat');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'countedChoice') {
    fail(`${context.room.gameName} Ephyra combat has ${binding.kind} producer`);
  }
  return Object.freeze({
    lifecycleProfileKey: context.lifecycleProfileKey ?? 'EphyraMainRoom',
    incomingReward: resolvedIncomingReward(
      context,
      'countedChoice',
      binding.producerLifecycleKey,
      state.reward.offer,
    ),
  });
}

function materializeFixedRoom(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  const state = requireStateKind(context, 'fixed');
  const binding = context.room.incomingReward;
  if (binding.kind !== 'fixed') {
    fail(`${context.room.gameName} fixed template has ${binding.kind} producer`);
  }
  const payload = state.reward.offer.payload ?? binding.offer.payload;
  return Object.freeze({
    lifecycleProfileKey: context.lifecycleProfileKey ?? 'StandardRewardRoom',
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
  return Object.freeze({
    lifecycleProfileKey:
      context.room.encounterEnvelopeKey === 'EmptyEncounter'
        ? 'RewardlessRoom'
        : 'RewardlessCombatRoom',
  });
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
  const slots = encounterEnvelopeSlots(context.catalog, context.room, context.room.gameName);
  const passive = slots.find((slot) => slot.key === 'Passive');
  const cageSlots = slots.filter(
    (slot) =>
      slot.rewardAttachment?.kind === 'localReward' &&
      slot.rewardAttachment.groupKey === descriptor.key,
  );
  if (
    context.room.encounterEnvelopeKey !== 'FieldsEncounter' ||
    passive === undefined ||
    passive.activation !== 'always' ||
    cageSlots.length < descriptor.maxActiveSlots
  ) {
    fail(`${context.room.gameName} has no complete Fields encounter envelope`);
  }
  const activeCageSlots = cageSlots.slice(0, activeCageCount);
  const localRewards = activeCageSlots.map((encounterSlot) => {
    const attachment = encounterSlot.rewardAttachment;
    if (attachment?.kind !== 'localReward') {
      return fail(`${context.room.gameName}.${encounterSlot.key} lacks a cage reward attachment`);
    }
    const reward = state.cages[attachment.slotKey];
    if (reward === undefined) {
      fail(`${context.room.gameName} is missing authored cage ${attachment.slotKey}`);
    }
    return Object.freeze({
      origin: createLocalRewardAddress(
        context.biome,
        context.occurrence.occurrenceId,
        attachment.groupKey,
        attachment.slotKey,
      ),
      groupKey: attachment.groupKey,
      slotKey: attachment.slotKey,
      encounterPhaseKey: encounterSlot.key,
      producerLifecycleKey: descriptor.reward.producerLifecycleKey,
      offer: reward.offer,
      traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
      traitContext: traitContextForOffer(context, reward.offer),
      resolvedStoreKey: storeKey,
    });
  });
  return Object.freeze({
    lifecycleProfileKey: 'FieldsCombatRoom',
    activeEncounterSlotKeys: Object.freeze([
      passive.key,
      ...activeCageSlots.map((slot) => slot.key),
    ]),
    localRewards: Object.freeze(localRewards),
  });
}

export function materializeShipCombatState(
  catalog: Catalog,
  biome: BiomeAddress,
  room: RoomDeclaration,
  occurrence: RoomOccurrence,
  traitContext?: TraitMaterializationContext,
): MaterializedShipCombatState {
  if (occurrence.state.kind !== 'shipCombat') {
    fail(`${occurrence.gameName} expected shipCombat state, received ${occurrence.state.kind}`);
  }
  const state = occurrence.state;
  const slots = encounterEnvelopeSlots(catalog, room, room.gameName);
  if (
    room.encounterEnvelopeKey !== 'ShipEncounter' ||
    slots[0]?.key !== 'Intro' ||
    slots[0].activation !== 'always' ||
    slots[1]?.key !== 'Combat1' ||
    slots[1].activation !== 'always' ||
    slots[2]?.key !== 'Combat2' ||
    slots[2].activation !== 'templateControlled' ||
    slots.length !== 3
  ) {
    fail(`${room.gameName} has no ShipCombat encounter envelope`);
  }
  const activeSlotKeys = Object.freeze(
    state.encounterCount === 2 ? ['Intro', 'Combat1'] : ['Intro', 'Combat1', 'Combat2'],
  );
  const encounterPhases = resolveEncounterPhases(
    catalog,
    room,
    occurrence.encounters,
    activeSlotKeys,
    room.gameName,
  );
  if (
    encounterPhases.length !== state.encounterCount ||
    encounterPhases[0]?.slotKey !== 'Intro' ||
    encounterPhases[1]?.rewardAttachment?.kind !== 'rewardWheel' ||
    encounterPhases[1].rewardAttachment.key !== 'wheel1' ||
    (state.encounterCount === 3 &&
      (encounterPhases[2]?.rewardAttachment?.kind !== 'rewardWheel' ||
        encounterPhases[2].rewardAttachment.key !== 'wheel2'))
  ) {
    fail(`${room.gameName} cannot materialize ${state.encounterCount} encounters`);
  }
  const rewardWheels: CanonicalRewardWheel[] = encounterPhases.flatMap((phase) => {
    const descriptor = phase.rewardAttachment;
    if (descriptor?.kind !== 'rewardWheel') {
      return [];
    }
    const wheel = state.wheels[descriptor.key];
    if (wheel === undefined) {
      fail(`${room.gameName} is missing ${descriptor.key}`);
    }
    const offers = descriptor.offerKeys.slice(0, wheel.offerCount).map((offerKey, index) => {
      const reward = wheel.offers[offerKey];
      if (reward === undefined) {
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
        offer: reward.offer,
        traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole,
        traitContext: Object.freeze({
          ...(traitContext ?? {}),
          blockGiftBoons: room.blockGiftBoons,
          devotionNoDuo: reward.offer.rewardType === 'Devotion',
        }),
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
        encounterPhaseKey: phase.slotKey,
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
    context.traitContext,
  );
  return Object.freeze({
    lifecycleProfileKey: 'ShipCombatRoom',
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
          offer: authored.reward.offer,
          traitOffersByAcquisitionRole: authored.reward.traitOffersByAcquisitionRole,
          traitContext: traitContextForOffer(context, authored.reward.offer),
        });
      }),
    ),
    purchaseOrder: shop.purchaseOrder,
  });
}

function materializeShopRoom(
  context: AuthoredRoomMaterializationContext,
  lifecycleProfileKey: 'PrebossShopRoom' | 'WorldShopRoom' = 'WorldShopRoom',
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

function materializePreboss(context: AuthoredRoomMaterializationContext): MaterializedRoomLeaf {
  if (context.role === 'prebossShop') {
    return materializeShopRoom(context, 'PrebossShopRoom');
  }
  if (context.role !== 'prebossFreeReward') {
    fail(`${context.room.gameName} has no declaration-derived Preboss role`);
  }
  const state = requireStateKind(context, 'freeReward');
  const policy = context.room.prebossBatchPolicy;
  if (policy?.kind !== 'takeOverNormalDoors' || policy.remainingOffers.kind !== 'counted') {
    fail(`${context.room.gameName} has no counted remaining-offer policy`);
  }
  return Object.freeze({
    lifecycleProfileKey: 'PrebossFreeRewardRoom',
    incomingReward: resolvedIncomingReward(
      context,
      'freeReward',
      policy.remainingOffers.reward.producerLifecycleKey,
      state.reward.offer,
    ),
  });
}

const authoredTemplateMaterializers = Object.freeze({
  Anomaly: materializeAnomaly,
  Chaos: materializeFixedRoom,
  ClockworkCombat: materializeClockworkCombat,
  ContractBoss: materializeFixedRoom,
  Devotion: materializeDevotion,
  EphyraCombat: materializeEphyraCombat,
  FixedIntro: materializeRewardlessRoom,
  FixedOpening: materializeCountedRoom,
  FixedPreHub: materializeCountedRoom,
  FieldsCombat: materializeFieldsCombat,
  Fountain: materializeCountedRoom,
  Miniboss: materializeCountedRoom,
  RewardlessCombat: (context) =>
    Object.freeze({
      ...materializeRewardlessRoom(context),
      lifecycleProfileKey: 'RewardlessCombatRoom',
    }),
  Shop: materializeShopRoom,
  Preboss: materializePreboss,
  ShipCombat: materializeShipCombat,
  StandardCombat: materializeCountedRoom,
  Story: materializeFixedRoom,
}) satisfies Readonly<Record<AuthoredTemplateKey, AuthoredTemplateMaterializer>>;

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
    fail(`${roomGameName} uses unsupported authored template ${templateKey}`);
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
  encounterEnvelopeKey: string,
): void {
  const profile = catalog.roomLifecycleProfiles.byKey[leaf.lifecycleProfileKey];
  if (profile === undefined) {
    fail(`${room.gameName} selected unknown lifecycle ${leaf.lifecycleProfileKey}`);
  }
  if (!profile.encounterEnvelopeKeys.includes(encounterEnvelopeKey)) {
    fail(`${room.gameName} envelope ${encounterEnvelopeKey} is incompatible with ${profile.key}`);
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

export function materializeAuthoredRoom(
  context: AuthoredRoomMaterializationContext,
): CanonicalAuthoredRoom {
  if (context.room.mode.kind !== 'authored') {
    fail(`${context.room.gameName} is not an authored room`);
  }
  const leaf = authoredMaterializer(context.room.mode.templateKey, context.room.gameName)(context);
  const selectedEncounterPhases =
    leaf.encounterPhases ??
    resolveEncounterPhases(
      context.catalog,
      context.room,
      context.occurrence.encounters,
      leaf.activeEncounterSlotKeys ??
        alwaysActiveEncounterSlotKeys(context.catalog, context.room, context.room.gameName),
      context.room.gameName,
    );
  const clockworkReward = leaf.clockworkReward ?? context.clockworkReward;
  requireLifecycleSelection(context.catalog, context.room, leaf, context.room.encounterEnvelopeKey);
  return Object.freeze({
    kind: 'authored',
    origin: createOccurrenceAddress(context.biome, context.occurrence.occurrenceId),
    occurrenceId: context.occurrence.occurrenceId,
    gameName: context.room.gameName,
    ...(context.occurrence.anomalyReplacement === undefined
      ? {}
      : { anomalyReplacement: context.occurrence.anomalyReplacement }),
    encounters: context.occurrence.encounters,
    encounterEnvelopeKey: context.room.encounterEnvelopeKey,
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
