import type { Catalog, RoomDeclaration } from '../../../catalog-schema';
import type { ShopRewardBinding } from '../../../reward-kernel/bindings';
import type { ShopProfileDeclaration } from '../../../reward-kernel/model';
import { pickupEffectForOffer, type ResolvedRewardOffer } from '../../../reward-kernel';
import type {
  AuthoredAnvilResult,
  AuthoredRewardState,
  ShopOfferState,
  ShopState,
} from '../../model';
import {
  expectArray,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../../validation';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  shopSlotProfile,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../../shop';
import { decodeNullableRewardState } from './reward-acquisition-codec';
import { rewardSourceResolvesAtAcquisition } from '../../acquisition/reward-state';

function decodeShopInventoryReward(
  value: unknown,
  catalog: Catalog,
  path: string,
  profileKey: string,
): AuthoredRewardState | null {
  if (value === null) return null;
  const raw = expectRecord(value, path);
  const offer = expectRecord(raw.offer, `${path}.offer`);
  const rewardType = expectString(offer.rewardType, `${path}.offer.rewardType`);
  if (catalog.rewards.rewardTypes.byKey[rewardType]?.sourceResolution?.kind !== 'acquisitionRole')
    return decodeNullableRewardState(value, catalog, path, {
      kind: 'shopProfile',
      key: profileKey,
    });

  expectExactKeys(
    raw,
    ['offer', 'traitOffersByAcquisitionRole', 'dispositionByAcquisitionRole'],
    path,
  );
  expectExactKeys(offer, ['rewardType'], `${path}.offer`);
  const traits = expectRecord(
    raw.traitOffersByAcquisitionRole,
    `${path}.traitOffersByAcquisitionRole`,
  );
  const dispositions = expectRecord(
    raw.dispositionByAcquisitionRole,
    `${path}.dispositionByAcquisitionRole`,
  );
  expectExactKeys(traits, [], `${path}.traitOffersByAcquisitionRole`);
  expectExactKeys(dispositions, [], `${path}.dispositionByAcquisitionRole`);
  return Object.freeze({
    offer: Object.freeze({ rewardType }),
    traitOffersByAcquisitionRole: Object.freeze({}),
    dispositionByAcquisitionRole: Object.freeze({}),
  });
}

function decodeAnvilResult(
  value: unknown,
  catalog: Catalog,
  offer: ResolvedRewardOffer,
  path: string,
): AuthoredAnvilResult | null | undefined {
  const expected = rewardSourceResolvesAtAcquisition(catalog, offer)
    ? undefined
    : pickupEffectForOffer(catalog.rewards, offer);
  if (expected === undefined) {
    if (value !== undefined)
      failProjectDocument(path, 'pickup effect results are not supported for this reward');
    return undefined;
  }
  if (value === undefined) failProjectDocument(path, 'is required for this reward pickup effect');
  if (value === null) return null;
  const entry = expectRecord(value, path);
  expectExactKeys(entry, ['kind', 'removedTraitKey', 'addedTraitKeys'], path);
  if (expectString(entry.kind, `${path}.kind`) !== expected.effect.kind)
    failProjectDocument(`${path}.kind`, `expected ${expected.effect.kind}`);
  const removedTraitKey =
    entry.removedTraitKey === null
      ? null
      : expectString(entry.removedTraitKey, `${path}.removedTraitKey`);
  const addedTraitKeys = expectArray(entry.addedTraitKeys, `${path}.addedTraitKeys`).map(
    (candidate, index) => expectString(candidate, `${path}.addedTraitKeys[${index}]`),
  );
  if (addedTraitKeys.length !== 2)
    failProjectDocument(`${path}.addedTraitKeys`, 'must contain exactly two traits');
  if (addedTraitKeys[0] === addedTraitKeys[1])
    failProjectDocument(`${path}.addedTraitKeys`, 'must contain distinct traits');
  return Object.freeze({
    kind: 'anvilOfFates',
    removedTraitKey,
    addedTraitKeys: Object.freeze(addedTraitKeys) as readonly [string, string],
  });
}

export function decodeShopState(
  value: unknown,
  catalog: Catalog,
  binding: ShopRewardBinding,
  room: RoomDeclaration,
  path: string,
): ShopState {
  const shop = expectRecord(value, path);
  const profileKey = expectString(shop.profileKey, `${path}.profileKey`);
  const profile = catalog.rewards.shops.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  expectExactKeys(shop, ['profileKey', 'offers', 'travelDealRefill'], path);
  if (profileKey !== binding.shopProfileKey) {
    failProjectDocument(`${path}.profileKey`, `expected ${binding.shopProfileKey}`);
  }
  const decoded = decodeShopOffers(shop.offers, catalog, profile, path, room);
  if (shop.travelDealRefill === undefined) return decoded;
  const travelDealRefill = decodeShopOffer(
    shop.travelDealRefill,
    catalog,
    profile,
    profile.groups.values.flatMap((group) => group.options.values),
    `${path}.travelDealRefill`,
  );
  return Object.freeze({ ...decoded, travelDealRefill });
}

/** Shared inventory payload policy; the caller supplies the declaration-owned option domain. */
function decodeShopOffer(
  value: unknown,
  catalog: Catalog,
  profile: ShopProfileDeclaration,
  options: readonly import('../../../reward-kernel').ShopOptionEntry[],
  path: string,
): ShopOfferState {
  const rawOffer = expectRecord(value, path);
  expectExactKeys(rawOffer, ['optionKey', 'reward', 'anvilResult'], path);
  const optionKey =
    rawOffer.optionKey === null ? null : expectString(rawOffer.optionKey, `${path}.optionKey`);
  const reward = decodeShopInventoryReward(rawOffer.reward, catalog, `${path}.reward`, profile.key);
  if (reward === null) {
    if (optionKey !== null) failProjectDocument(`${path}.optionKey`, 'requires a selected reward');
    if (rawOffer.anvilResult !== undefined)
      failProjectDocument(`${path}.anvilResult`, 'requires a selected Anvil reward');
    return Object.freeze({ optionKey: null, reward: null });
  }
  const option =
    optionKey === null ? undefined : options.find((candidate) => candidate.key === optionKey);
  if (optionKey !== null && option === undefined)
    failProjectDocument(`${path}.optionKey`, `unknown shop option ${optionKey}`);
  if (option !== undefined && option.rewardType !== reward.offer.rewardType)
    failProjectDocument(
      `${path}.optionKey`,
      `${optionKey} does not produce ${reward.offer.rewardType}`,
    );
  if (!options.some((candidate) => candidate.rewardType === reward.offer.rewardType))
    failProjectDocument(
      `${path}.reward.offer.rewardType`,
      `${reward.offer.rewardType} is not available from ${profile.key}`,
    );
  const anvilResult = decodeAnvilResult(
    rawOffer.anvilResult,
    catalog,
    reward.offer,
    `${path}.anvilResult`,
  );
  return Object.freeze({
    optionKey,
    reward,
    ...(anvilResult === undefined ? {} : { anvilResult }),
  });
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
  profile: ShopProfileDeclaration,
  path: string,
  room: RoomDeclaration,
): ShopState {
  const rawOffers = expectRecord(value, `${path}.offers`);
  expectExactKeys(
    rawOffers,
    [
      ...profile.slots.values.map((slot) => slot.key),
      ...(room.infernalContractReward === undefined ? [] : ['infernalContractReward']),
    ],
    `${path}.offers`,
  );
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of [
    ...profile.slots.values,
    ...(room.infernalContractReward === undefined
      ? []
      : [{ key: 'infernalContractReward', groupKey: 'Reward' }]),
  ]) {
    if (
      slot.key === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
      slot.key === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
    ) {
      failProjectDocument(
        `${path}.offers`,
        `${slot.key} is reserved for a supplemental Shop entry`,
      );
    }
    const offerPath = `${path}.offers.${slot.key}`;
    const offerProfile = shopSlotProfile(catalog, room.gameName, profile.key, slot.key);
    if (offerProfile === undefined)
      failProjectDocument(offerPath, 'shop offer has no declaration-owned profile');
    const group = offerProfile.groups.byKey[slot.groupKey];
    if (group === undefined) failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    offers[slot.key] = decodeShopOffer(
      rawOffers[slot.key],
      catalog,
      offerProfile,
      group.options.values,
      offerPath,
    );
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}
