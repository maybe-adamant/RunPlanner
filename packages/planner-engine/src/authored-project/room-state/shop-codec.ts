import type { Catalog } from '../../catalog-schema';
import type { ShopRewardBinding } from '../../reward-kernel/bindings';
import type { ShopProfileDeclaration } from '../../reward-kernel/model';
import type { ShopOfferState, ShopState } from '../model';
import { expectExactKeys, expectRecord, expectString, failProjectDocument } from '../validation';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';
import { decodeNullableRewardState } from './reward-acquisition-codec';

export function decodeShopState(
  value: unknown,
  catalog: Catalog,
  binding: ShopRewardBinding,
  path: string,
): ShopState {
  const shop = expectRecord(value, path);
  const profileKey = expectString(shop.profileKey, `${path}.profileKey`);
  const profile = catalog.rewards.shops.byKey[profileKey];
  if (profile === undefined) {
    failProjectDocument(`${path}.profileKey`, `unknown shop profile ${profileKey}`);
  }
  expectExactKeys(shop, ['profileKey', 'offers'], path);
  if (profileKey !== binding.shopProfileKey) {
    failProjectDocument(`${path}.profileKey`, `expected ${binding.shopProfileKey}`);
  }
  return Object.freeze({
    ...decodeShopOffers(shop.offers, catalog, profile, path),
  });
}

function decodeShopOffers(
  value: unknown,
  catalog: Catalog,
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
      slot.key === INFERNAL_CONTRACT_ENTRY_KEY ||
      slot.key === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
      slot.key === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
    ) {
      failProjectDocument(
        `${path}.offers`,
        `${slot.key} is reserved for a supplemental Shop entry`,
      );
    }
    const offerPath = `${path}.offers.${slot.key}`;
    const rawOffer = expectRecord(rawOffers[slot.key], offerPath);
    expectExactKeys(rawOffer, ['reward'], offerPath);
    const reward = decodeNullableRewardState(rawOffer.reward, catalog, `${offerPath}.reward`, {
      kind: 'shopProfile',
      key: profile.key,
    });
    if (reward === null) {
      offers[slot.key] = Object.freeze({ reward: null });
      continue;
    }
    const offer = reward.offer;
    const group = profile.groups.byKey[slot.groupKey];
    if (group === undefined) {
      failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    }
    if (!group.options.values.some((option) => option.rewardType === offer.rewardType)) {
      failProjectDocument(
        `${offerPath}.reward.offer.rewardType`,
        `${offer.rewardType} is not available from ${slot.groupKey}`,
      );
    }
    offers[slot.key] = Object.freeze({ reward });
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}
