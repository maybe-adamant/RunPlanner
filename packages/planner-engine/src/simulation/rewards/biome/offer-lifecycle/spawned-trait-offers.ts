import {
  createAcquisitionEntryAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../../../authored-project/addresses';
import type { Catalog } from '../../../../catalog-schema';
import { forGeneration, type CanonicalAuthoredRoom } from '../../../materialization';
import { roomRunsCages } from '../../../encounters/model';
import {
  hermesShrineDeliveryEntryKey,
  isSameRoomDelivery,
} from '../../../../authored-project/hermes-shrine-delivery';
import {
  applyTraitOfferContextTransition,
  spawnPendingTraitOffers,
  traitOfferRoomKey,
  type SpawnedTraitOffer,
  type TraitOfferContextTransition,
} from '../../../state/pending-trait-offers';
import { appendRewardEvent, type RewardBranchState } from '../../branch-primitives';
import {
  forfeitedPickupOf,
  recordForfeitedPickup,
  spawnPickups,
  type SpawnedPickup,
} from '../../../state/pending-resource-pickups';
import {
  resolveAcquisitionRole,
  type ConcreteAcquisitionEvent,
  type ProducerLifecyclePointKey,
  type ResolvedRewardOffer,
} from '../../../../reward-kernel';
import { consumeRoomRewardForfeit } from '../../../arcana-fear';
import { consumeOlympianProviderMaterialized } from '../../../keepsakes/reward-effects';
import type { SimulationState } from '../../../state/model';
import type { ForfeitPeek } from '../../acquisition/contracts';

function withState(
  branch: RewardBranchState,
  state: RewardBranchState['state'],
): RewardBranchState {
  return state === branch.state ? branch : Object.freeze({ ...branch, state });
}

export function spawnTraitOffers(
  catalog: Catalog,
  branch: RewardBranchState,
  spawned: readonly SpawnedTraitOffer[],
  roles?: readonly string[],
): RewardBranchState {
  return withState(branch, spawnPendingTraitOffers(catalog, branch.state, spawned, roles));
}

/** Applies one invalidation or rebuild product to every unopened loot in a room. */
export function applyTraitOfferTransition(
  branch: RewardBranchState,
  transition: TraitOfferContextTransition,
): RewardBranchState {
  return withState(branch, applyTraitOfferContextTransition(branch.state, transition));
}

export function invalidatedTraitOffers(
  room: SemanticAddress,
  source: Extract<TraitOfferContextTransition, { readonly kind: 'invalidated' }>['source'],
): TraitOfferContextTransition | undefined {
  const key = traitOfferRoomKey(room);
  return key === undefined ? undefined : Object.freeze({ kind: 'invalidated', room: key, source });
}

/** Roles of one loot that already settled, so a later spawn does not recreate them. */
function settledRoles(branch: RewardBranchState, origin: SemanticAddress): readonly string[] {
  const key = semanticAddressKey(origin);
  return branch.events.flatMap((event) =>
    (event.kind === 'concreteAcquisition' ||
      event.kind === 'conversionToGold' ||
      event.kind === 'artificerConversion') &&
    semanticAddressKey(event.origin) === key
      ? [event.acquisition.role]
      : [],
  );
}

/** One object a room-reward host spawns, as `SpawnRoomReward` or `GiveLoot` receives it. */
export interface RewardSpawn {
  readonly origin: TraitOfferOwnerAddress;
  readonly offer: ResolvedRewardOffer;
  readonly producerLifecycleKey: string;
  /**
   * It spawns through `SpawnRoomReward` (RewardLogic.lua:303-420), whose Boon
   * or Hermes reward Forfeit may replace; Devotion, deliveries and purchases do not.
   */
  readonly forfeitEligible: boolean;
}

function forfeitRewardType(spawn: RewardSpawn): 'Boon' | 'HermesUpgrade' | undefined {
  const { rewardType } = spawn.offer;
  return spawn.forfeitEligible && (rewardType === 'Boon' || rewardType === 'HermesUpgrade')
    ? rewardType
    : undefined;
}

function spawnRoles(catalog: Catalog, spawn: RewardSpawn, roles?: readonly string[]) {
  return (
    catalog.rewards.producerLifecycles.byKey[spawn.producerLifecycleKey]?.rewardTypes.byKey[
      spawn.offer.rewardType
    ]?.acquisitionLifecycle ?? []
  ).filter((binding) => roles === undefined || roles.includes(binding.role));
}

/** One role of a reward Forfeit replaced, realized as its consumable. */
export function forfeitRealization(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  binding: { readonly role: string; readonly lifecyclePoint: ProducerLifecyclePointKey },
  replacement: 'RoomRewardConsolationPrize',
): ConcreteAcquisitionEvent {
  return Object.freeze({
    ...resolveAcquisitionRole(catalog.rewards, offer, binding.role, binding.lifecyclePoint),
    acquisition: Object.freeze({ kind: 'consumable' as const, gameName: replacement }),
  });
}

/** Whether Forfeit would take this spawn now: the game's Onion preview reads the same check. */
export function forfeitWouldTake(
  catalog: Catalog,
  state: SimulationState,
  spawn: RewardSpawn,
  historySequence: number,
): boolean {
  const rewardType = forfeitRewardType(spawn);
  return (
    rewardType !== undefined &&
    consumeRoomRewardForfeit(catalog, state.arcanaFear, rewardType, {
      owner: spawn.origin,
      sequence: historySequence,
    }).consumed
  );
}

/**
 * The rewards a door shows for the room behind it, as first drawn: its room
 * reward and, into a Fields room, each cage's.
 */
export function doorRewardSpawns(room: CanonicalAuthoredRoom): readonly RewardSpawn[] {
  const incoming = room.incomingReward;
  return Object.freeze([
    ...(incoming === undefined
      ? []
      : [
          {
            origin: incoming.origin,
            offer: forGeneration(incoming).offer,
            producerLifecycleKey: incoming.producerLifecycleKey,
            forfeitEligible: incoming.producerLifecycleKey === 'RoomReward',
          },
        ]),
    ...(roomRunsCages(room)
      ? (room.localRewards ?? []).map((reward) => ({
          origin: reward.origin,
          offer: forGeneration(reward).offer,
          producerLifecycleKey: reward.producerLifecycleKey,
          forfeitEligible: true,
        }))
      : []),
  ]);
}

/** The Onion previews of rewards shown before they spawn: doors, wheels and Fields cages. */
export function forfeitPeeks(
  catalog: Catalog,
  state: SimulationState,
  spawns: readonly RewardSpawn[],
  historySequence: number,
): readonly ForfeitPeek[] {
  return Object.freeze(
    spawns.map((spawn) =>
      Object.freeze({
        owner: spawn.origin,
        offer: spawn.offer,
        producerLifecycleKey: spawn.producerLifecycleKey,
        historySequence,
        takes: forfeitWouldTake(catalog, state, spawn, historySequence),
      }),
    ),
  );
}

/**
 * The spawn's own decisions, made once as the object is created: Forfeit
 * replaces the first eligible Boon or Hermes reward of the biome
 * (ShrineLogic.lua:918-927), recorded on the object; otherwise the loot is
 * created, spending each Olympian keepsake that forces its god
 * (RoomLogic.lua:2060-2073). An object already decided is left as it is.
 */
export function settleRewardSpawn(
  catalog: Catalog,
  branch: RewardBranchState,
  spawn: RewardSpawn,
  historySequence: number,
  roles?: readonly string[],
): RewardBranchState {
  const bindings = spawnRoles(catalog, spawn, roles);
  if (bindings.some((binding) => forfeitedPickupOf(branch.state, spawn.origin, binding.role)))
    return branch;
  const rewardType = forfeitRewardType(spawn);
  const forfeit =
    rewardType === undefined
      ? undefined
      : consumeRoomRewardForfeit(catalog, branch.state.arcanaFear, rewardType, {
          owner: spawn.origin,
          sequence: historySequence,
        });
  if (forfeit?.consumed === true)
    return appendRewardEvent(
      withState(
        branch,
        recordForfeitedPickup(
          Object.freeze({ ...branch.state, arcanaFear: forfeit.state }),
          spawn.origin,
          bindings.map((binding) =>
            forfeitRealization(catalog, spawn.offer, binding, forfeit.replacementRewardType),
          ),
        ),
      ),
      historySequence,
      Object.freeze({
        kind: 'rewardForfeited' as const,
        origin: spawn.origin,
        rewardType: rewardType!,
        replacementRewardType: forfeit.replacementRewardType,
      }),
    );
  let keepsakes = branch.state.keepsakes;
  for (const binding of bindings) {
    const giver =
      catalog.traitGiverByAcquisitionGameName[
        resolveAcquisitionRole(catalog.rewards, spawn.offer, binding.role, binding.lifecyclePoint)
          .acquisition.gameName
      ];
    if (giver !== undefined)
      keepsakes = consumeOlympianProviderMaterialized(keepsakes, giver, 'free');
  }
  return keepsakes === branch.state.keepsakes
    ? branch
    : withState(branch, Object.freeze({ ...branch.state, keepsakes }));
}

function spawnIncomingReward(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  const reward = room.incomingReward;
  if (reward === undefined) return branch;
  const settled = settledRoles(branch, reward.origin);
  const unsettled = (
    catalog.rewards.rewardTypes.byKey[reward.offer.rewardType]?.acquisitionRoles.values ?? []
  )
    .map((role) => role.key)
    .filter((role) => !settled.includes(role));
  const decided = settleRewardSpawn(
    catalog,
    branch,
    { ...reward, forfeitEligible: reward.producerLifecycleKey === 'RoomReward' },
    sequence,
    unsettled,
  );
  return withState(decided, spawnPickups(catalog, decided.state, [reward], unsettled));
}

/** Whether one of the room's encounters spawns its incoming reward before combat. */
export function incomingRewardCreatedAtEncounterStart(
  catalog: Catalog,
  encounterKeys: readonly string[],
): boolean {
  return encounterKeys.some(
    (key) => catalog.encounterDefinitions.byKey[key]?.createsIncomingRewardAtStart === true,
  );
}

/** An encounter that spawns the room reward first (the H minibosses) anchors it at its start. */
export function spawnIncomingRewardAtEncounterStart(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  encounterKey: string,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  return incomingRewardCreatedAtEncounterStart(catalog, [encounterKey])
    ? spawnIncomingReward(catalog, room, branch, sequence)
    : branch;
}

/**
 * Otherwise an incoming reward spawns at the end of its producing encounter:
 * the last completed encounter before the role's producer point. Roles already
 * acquired before that encounter (Devotion's chosen pair) are not respawned.
 * This relies on the declared lifecycles: every post-combat producer point
 * follows the room's last encounter, and pre-combat roles settle before combat.
 */
export function spawnIncomingRewardAtEncounterCompletion(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  roomEncounterKeys: readonly string[],
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  return incomingRewardCreatedAtEncounterStart(catalog, roomEncounterKeys)
    ? branch
    : spawnIncomingReward(catalog, room, branch, sequence);
}

/** A ship wheel's selected reward spawns after its own phase's combat. */
export function spawnWheelRewardAtEncounterCompletion(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  phaseKey: string,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  const picked = (room.rewardWheels ?? [])
    .filter((wheel) => wheel.encounterPhaseKey === phaseKey)
    .flatMap((wheel) =>
      wheel.offers
        .filter((offer) => offer.picked)
        .map((offer) => ({ ...offer, producerLifecycleKey: wheel.producerLifecycleKey })),
    );
  const decided = picked.reduce(
    (current, offer) =>
      settleRewardSpawn(catalog, current, { ...offer, forfeitEligible: true }, sequence),
    branch,
  );
  return picked.length === 0
    ? branch
    : withState(decided, spawnPickups(catalog, decided.state, picked));
}

/** Loot authored at an acquisition site, spawned when its native creation contact runs. */
export function siteEntryTraitOffers(
  room: CanonicalAuthoredRoom,
  siteKey: string,
  entryKeys?: readonly string[],
): readonly SpawnedTraitOffer[] {
  const site = room.acquisitionSites?.[siteKey];
  if (site === undefined) return Object.freeze([]);
  return Object.freeze(
    Object.entries(site.entries).flatMap(([entryKey, entry]) =>
      entry === null || (entryKeys !== undefined && !entryKeys.includes(entryKey))
        ? []
        : [
            Object.freeze({
              origin: createAcquisitionEntryAddress(site.address, entryKey),
              offer: entry.offer,
              traitOffersByAcquisitionRole: entry.traitOffersByAcquisitionRole,
              levelResolutionsByAcquisitionRole: entry.levelResolutionsByAcquisitionRole,
            }),
          ],
    ),
  );
}

/** The generated pickups one completed screen creates, from its selected producers. */
export function screenProducedPickups(
  room: CanonicalAuthoredRoom,
  screenOwner: TraitOfferOwnerAddress,
  acquisitionRole: string,
): readonly SpawnedPickup[] {
  const source = semanticAddressKey(createTraitOfferAddress(screenOwner, acquisitionRole));
  return Object.freeze(
    (room.pickupProducers ?? []).flatMap((producer) =>
      producer.sourceNormal && semanticAddressKey(producer.source) === source
        ? siteEntryTraitOffers(
            room,
            producer.siteKey,
            producer.pickups.map((pickup) => pickup.key),
          ).map((pickup) =>
            Object.freeze({ ...pickup, producerLifecycleKey: producer.producerLifecycleKey }),
          )
        : [],
    ),
  );
}

/**
 * Pickups a completed screen creates (Buried Treasure's gift, Echo's last
 * reward) spawn at that screen's close, after its selection is equipped.
 */
export function spawnScreenProducedPickups(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  screenOwner: TraitOfferOwnerAddress,
  acquisitionRole: string,
  branch: RewardBranchState,
): RewardBranchState {
  const spawned = screenProducedPickups(room, screenOwner, acquisitionRole);
  return spawned.length === 0
    ? branch
    : withState(branch, spawnPickups(catalog, branch.state, spawned));
}

/** A Hermes delivery spawns when it falls due at its host room. */
export function spawnDueHermesDeliveries(
  catalog: Catalog,
  room: CanonicalAuthoredRoom | undefined,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  if (room === undefined) return branch;
  const entryKeys = Object.values(branch.state.pendingHermesShrineDeliveries).flatMap((delivery) =>
    // It spawns at the contact where it fell due here.
    delivery.due !== undefined &&
    isSameRoomDelivery(delivery.due.host, room.origin) &&
    delivery.due.historySequence === sequence
      ? [hermesShrineDeliveryEntryKey(delivery.source, delivery.generationKey)]
      : [],
  );
  return entryKeys.length === 0
    ? branch
    : spawnTraitOffers(
        catalog,
        branch,
        siteEntryTraitOffers(room, 'hermesShrineDelivery', entryKeys),
      );
}
