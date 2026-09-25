import {
  createAcquisitionEntryAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type SemanticAddress,
  type TraitOfferOwnerAddress,
} from '../../../../authored-project/addresses';
import type { Catalog } from '../../../../catalog-schema';
import type { CanonicalAuthoredRoom } from '../../../materialization';
import { hermesShrineDeliveryEntryKey } from '../../../../authored-project/hermes-shrine-delivery';
import {
  applyTraitOfferContextTransition,
  spawnPendingTraitOffers,
  traitOfferRoomKey,
  type SpawnedTraitOffer,
  type TraitOfferContextTransition,
} from '../../../state/pending-trait-offers';
import type { RewardBranchState } from '../../branch-primitives';

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

/**
 * An incoming reward spawns at the end of its producing encounter: the last
 * completed encounter before the role's producer point. Roles already
 * acquired before that encounter (Devotion's chosen pair) are not respawned.
 * This relies on the declared lifecycles: every post-combat producer point
 * follows the room's last encounter, and pre-combat roles settle before combat.
 */
export function spawnIncomingRewardAtEncounterCompletion(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  branch: RewardBranchState,
): RewardBranchState {
  const reward = room.incomingReward;
  if (reward === undefined) return branch;
  const settled = settledRoles(branch, reward.origin);
  const roles = [
    ...Object.keys(reward.traitOffersByAcquisitionRole ?? {}),
    ...Object.keys(reward.levelResolutionsByAcquisitionRole ?? {}),
  ].filter((role) => !settled.includes(role));
  return roles.length === 0 ? branch : spawnTraitOffers(catalog, branch, [reward], roles);
}

/** A ship wheel's selected reward spawns after its own phase's combat. */
export function spawnWheelRewardAtEncounterCompletion(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  phaseKey: string,
  branch: RewardBranchState,
): RewardBranchState {
  const picked = (room.rewardWheels ?? [])
    .filter((wheel) => wheel.encounterPhaseKey === phaseKey)
    .flatMap((wheel) => wheel.offers.filter((offer) => offer.picked));
  return picked.length === 0 ? branch : spawnTraitOffers(catalog, branch, picked);
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

/** Pickups a completed screen creates (Echo's last reward) spawn at that screen's close. */
export function spawnScreenProducedPickups(
  catalog: Catalog,
  room: CanonicalAuthoredRoom,
  screenOwner: TraitOfferOwnerAddress,
  acquisitionRole: string,
  branch: RewardBranchState,
): RewardBranchState {
  const source = semanticAddressKey(createTraitOfferAddress(screenOwner, acquisitionRole));
  const spawned = (room.pickupProducers ?? []).flatMap((producer) =>
    producer.sourceNormal && semanticAddressKey(producer.source) === source
      ? siteEntryTraitOffers(
          room,
          producer.siteKey,
          producer.pickups.map((pickup) => pickup.key),
        )
      : [],
  );
  return spawned.length === 0 ? branch : spawnTraitOffers(catalog, branch, spawned);
}

/** A Hermes delivery spawns when it falls due at its host room. */
export function spawnDueHermesDeliveries(
  catalog: Catalog,
  room: CanonicalAuthoredRoom | undefined,
  branch: RewardBranchState,
  sequence: number,
): RewardBranchState {
  if (room === undefined) return branch;
  const host = semanticAddressKey(room.origin);
  const entryKeys = Object.values(branch.state.pendingHermesShrineDeliveries).flatMap((delivery) =>
    delivery.dueAt !== undefined &&
    semanticAddressKey(delivery.dueAt) === host &&
    delivery.dueSequence === sequence
      ? [hermesShrineDeliveryEntryKey(delivery.sourceOrigin, delivery.generationKey)]
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
