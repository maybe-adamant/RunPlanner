import type { Catalog } from '../../../catalog-schema';
import type { ShopRewardBinding } from '../../../reward-kernel/bindings';
import type { ShopProfileDeclaration } from '../../../reward-kernel/model';
import type { AuthoredRewardState, ShopOfferState, ShopState } from '../../model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from '../../validation';
import { ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY, TRAVEL_DEAL_REFILL_ENTRY_KEY } from '../../shop';
import { decodeNullableRewardState } from './reward-acquisition-codec';

function decodeShopInventoryReward(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
  path: string,
  profileKey: string,
): AuthoredRewardState | null {
  if (value === null) return null;
  const raw = expectRecord(value, path);
  const offer = expectRecord(raw.offer, `${path}.offer`);
  const rewardType = expectString(offer.rewardType, `${path}.offer.rewardType`);
  if (catalog.rewards.rewardTypes.byKey[rewardType]?.sourceResolution?.kind !== 'acquisitionRole')
    return decodeNullableRewardState(
      value,
      catalog,
      path,
      { kind: 'shopProfile', key: profileKey },
      routeKey,
    );

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

export function decodeShopState(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
  binding: ShopRewardBinding,
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
  const decoded = decodeShopOffers(shop.offers, catalog, routeKey, profile, path);
  if (shop.travelDealRefill === undefined) return decoded;
  const travelDealRefill = decodeShopOffer(
    shop.travelDealRefill,
    catalog,
    routeKey,
    profile,
    profile.groups.values.flatMap((group) => group.options.values),
    `${path}.travelDealRefill`,
  );
  return Object.freeze({ ...decoded, travelDealRefill });
}

/** Shared inventory payload policy; the caller supplies the declaration-owned option domain. */
export function decodeShopOffer(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
  profile: ShopProfileDeclaration,
  options: readonly import('../../../reward-kernel').ShopOptionEntry[],
  path: string,
): ShopOfferState {
  const rawOffer = expectRecord(value, path);
  expectExactKeys(rawOffer, ['optionKey', 'reward'], path);
  const optionKey =
    rawOffer.optionKey === null ? null : expectString(rawOffer.optionKey, `${path}.optionKey`);
  const reward = decodeShopInventoryReward(
    rawOffer.reward,
    catalog,
    routeKey,
    `${path}.reward`,
    profile.key,
  );
  if (reward === null) {
    if (optionKey !== null) failProjectDocument(`${path}.optionKey`, 'requires a selected reward');
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
  return Object.freeze({ optionKey, reward });
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
  routeKey: string,
  profile: ShopProfileDeclaration,
  path: string,
): ShopState {
  const rawOffers = expectRecord(value, `${path}.offers`);
  expectExactKeys(
    rawOffers,
    profile.slots.values.map((slot) => slot.key),
    `${path}.offers`,
  );
  const offers: Record<string, ShopOfferState> = {};
  for (const slot of profile.slots.values) {
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
    const group = profile.groups.byKey[slot.groupKey];
    if (group === undefined) failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    offers[slot.key] = decodeShopOffer(
      rawOffers[slot.key],
      catalog,
      routeKey,
      profile,
      group.options.values,
      offerPath,
    );
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}
