import type { AcquisitionRoleAddress, BiomeAddress, TraitOfferOwnerAddress } from './addresses';
import {
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createRewardWheelOfferAddress,
  createShopOfferAddress,
  semanticAddressKey,
} from './addresses';
import { acquisitionSiteFromStorageKey } from './artificer';
import { roomActionKey } from './room-action-key';
import type { AuthoredRewardState, RoomActionReference, RoomOccurrence } from './model';

/** One concrete authored acquisition and the exact action which can settle it. */
export interface AuthoredAcquisitionSource {
  readonly acquisition: AcquisitionRoleAddress;
  readonly reward: AuthoredRewardState;
  /** Undefined retains a structurally valid source whose parent action is dormant or omitted. */
  readonly action?: RoomActionReference;
}

function sourceAction(
  occurrence: RoomOccurrence,
  owner: TraitOfferOwnerAddress,
  acquisitionRole: string,
): RoomActionReference | undefined {
  const expected = (reference: RoomActionReference): boolean => {
    switch (owner.kind) {
      case 'incomingReward':
        return (
          reference.kind === 'interactIncomingReward' &&
          reference.acquisitionRole === acquisitionRole
        );
      case 'localReward':
        return (
          reference.kind === 'interactLocalReward' &&
          reference.groupKey === owner.groupKey &&
          reference.slotKey === owner.slotKey
        );
      case 'rewardWheelOffer':
        return reference.kind === 'interactWheelReward' && reference.wheelKey === owner.wheelKey;
      case 'shopOffer':
        return reference.kind === 'interactShopOffer' && reference.offerKey === owner.offerKey;
      case 'acquisitionEntry':
        return (
          reference.kind === 'interactAcquisitionEntry' &&
          reference.siteKey === owner.site.pointKey &&
          reference.entryKey === owner.entryKey
        );
      case 'encounterPhase':
      case 'gorgonPhase':
        return false;
    }
  };
  return occurrence.roomActions.order.find(expected);
}

/**
 * The closed conversion-source projection shared by authored commands, decode
 * reattestation, and retained generated pickups. It deliberately includes a
 * source even when its action is not currently participating.
 */
export function authoredAcquisitionSources(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
): readonly AuthoredAcquisitionSource[] {
  const result: AuthoredAcquisitionSource[] = [];
  const add = (
    owner: TraitOfferOwnerAddress,
    reward: AuthoredRewardState | null | undefined,
  ): void => {
    if (reward === null || reward === undefined) return;
    for (const acquisitionRole of Object.keys(reward.dispositionByAcquisitionRole)) {
      const acquisition = createAcquisitionRoleAddress(owner, acquisitionRole);
      const action = sourceAction(occurrence, owner, acquisitionRole);
      result.push(
        Object.freeze({
          acquisition,
          reward,
          ...(action === undefined ? {} : { action }),
        }),
      );
    }
  };
  switch (occurrence.state.kind) {
    case 'counted':
    case 'fixed':
    case 'anomaly':
    case 'ephyraCombat':
    case 'freeReward':
      add(createIncomingRewardAddress(biome, occurrence.occurrenceId), occurrence.state.reward);
      break;
    case 'fieldsCombat':
      for (const [slotKey, reward] of Object.entries(occurrence.state.cages))
        add(createLocalRewardAddress(biome, occurrence.occurrenceId, 'cages', slotKey), reward);
      for (const [slotKey, reward] of Object.entries(occurrence.state.optionalRewards))
        add(
          createLocalRewardAddress(biome, occurrence.occurrenceId, 'optionalRewards', slotKey),
          reward,
        );
      break;
    case 'shipCombat':
      for (const [wheelKey, wheel] of Object.entries(occurrence.state.wheels))
        for (const [offerKey, reward] of Object.entries(wheel.offers))
          add(
            createRewardWheelOfferAddress(biome, occurrence.occurrenceId, wheelKey, offerKey),
            reward,
          );
      break;
    case 'shop':
      for (const [offerKey, offer] of Object.entries(occurrence.state.shop?.offers ?? {}))
        add(createShopOfferAddress(biome, occurrence.occurrenceId, offerKey), offer.reward);
      break;
    case 'none':
      break;
  }
  const occurrenceAddress = createOccurrenceAddress(biome, occurrence.occurrenceId);
  for (const [siteKey, site] of Object.entries(occurrence.acquisitionSites ?? {})) {
    const address = acquisitionSiteFromStorageKey(occurrenceAddress, siteKey);
    if (address === undefined) continue;
    for (const [entryKey, reward] of Object.entries(site.pickupEntries ?? {}))
      add(createAcquisitionEntryAddress(address, entryKey), reward);
  }
  return Object.freeze(result);
}

export function authoredAcquisitionSourceAt(
  biome: BiomeAddress,
  occurrence: RoomOccurrence,
  acquisition: AcquisitionRoleAddress,
): AuthoredAcquisitionSource | undefined {
  const key = semanticAddressKey(acquisition);
  return authoredAcquisitionSources(biome, occurrence).find(
    (source) => semanticAddressKey(source.acquisition) === key,
  );
}

/** Stable action membership helper for generated-source dependency checks. */
export function acquisitionSourceIsParticipating(
  occurrence: RoomOccurrence,
  source: AuthoredAcquisitionSource,
): boolean {
  return (
    source.action !== undefined &&
    occurrence.roomActions.order.some(
      (reference) => roomActionKey(reference) === roomActionKey(source.action!),
    )
  );
}
