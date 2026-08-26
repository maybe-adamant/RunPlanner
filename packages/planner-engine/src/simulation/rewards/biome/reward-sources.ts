import {
  createAcquisitionEntryAddress,
  semanticAddressKey,
  type TraitOfferOwnerAddress,
} from '../../../authored-project/addresses';
import type { AuthoredRewardState } from '../../../authored-project/model';
import type { CanonicalAuthoredRoom } from '../../materialization';

function canonicalRewardState(reward: {
  readonly offer: AuthoredRewardState['offer'];
  readonly traitOffersByAcquisitionRole?: AuthoredRewardState['traitOffersByAcquisitionRole'];
  readonly levelResolutionsByAcquisitionRole?: AuthoredRewardState['levelResolutionsByAcquisitionRole'];
  readonly dispositionByAcquisitionRole?: AuthoredRewardState['dispositionByAcquisitionRole'];
}): AuthoredRewardState {
  return Object.freeze({
    offer: reward.offer,
    traitOffersByAcquisitionRole: reward.traitOffersByAcquisitionRole ?? Object.freeze({}),
    ...(reward.levelResolutionsByAcquisitionRole === undefined
      ? {}
      : { levelResolutionsByAcquisitionRole: reward.levelResolutionsByAcquisitionRole }),
    dispositionByAcquisitionRole: reward.dispositionByAcquisitionRole ?? Object.freeze({}),
  });
}

/** Resolves one canonical authored source for a generated acquisition site. */
export function canonicalArtificerSource(
  room: CanonicalAuthoredRoom,
  sourceKey: string,
):
  | {
      readonly owner: TraitOfferOwnerAddress;
      readonly reward: AuthoredRewardState;
      readonly producerLifecycleKey?: string;
    }
  | undefined {
  const candidates: {
    readonly owner: TraitOfferOwnerAddress;
    readonly reward: AuthoredRewardState;
    readonly producerLifecycleKey?: string;
  }[] = [];
  if (room.incomingReward !== undefined)
    candidates.push({
      owner: room.incomingReward.origin,
      reward: canonicalRewardState(room.incomingReward),
      producerLifecycleKey: room.incomingReward.producerLifecycleKey,
    });
  for (const reward of [...(room.localRewards ?? []), ...(room.fieldsOptionalRewards ?? [])])
    candidates.push({
      owner: reward.origin,
      reward: canonicalRewardState(reward),
      producerLifecycleKey: reward.producerLifecycleKey,
    });
  for (const wheel of room.rewardWheels ?? [])
    for (const reward of wheel.offers)
      candidates.push({
        owner: reward.origin,
        reward: canonicalRewardState(reward),
        producerLifecycleKey: wheel.producerLifecycleKey,
      });
  if (room.entryState?.kind === 'shop')
    for (const reward of room.entryState.offers)
      candidates.push({ owner: reward.offerOrigin, reward: canonicalRewardState(reward) });
  for (const site of Object.values(room.acquisitionSites))
    for (const [entryKey, reward] of Object.entries(site.entries)) {
      if (reward === null) continue;
      const producerLifecycleKey = room.pickupProducers?.find(
        (producer) => producer.siteKey === site.address.pointKey,
      )?.producerLifecycleKey;
      candidates.push({
        owner: createAcquisitionEntryAddress(site.address, entryKey),
        reward,
        ...(producerLifecycleKey === undefined ? {} : { producerLifecycleKey }),
      });
    }
  return candidates.find((candidate) => semanticAddressKey(candidate.owner) === sourceKey);
}
