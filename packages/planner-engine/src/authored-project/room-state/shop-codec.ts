import type { Catalog } from '../../catalog-schema';
import type { ShopRewardBinding } from '../../reward-kernel/bindings';
import type { ShopProfileDeclaration } from '../../reward-kernel/model';
import { pickupEffectForOffer, type ResolvedRewardOffer } from '../../reward-kernel';
import type { AuthoredAnvilResult, AuthoredRewardState, ShopOfferState, ShopState } from '../model';
import {
  expectArray,
  expectExactKeys,
  expectRecord,
  expectString,
  failProjectDocument,
} from '../validation';
import {
  ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY,
  INFERNAL_CONTRACT_ENTRY_KEY,
  TRAVEL_DEAL_REFILL_ENTRY_KEY,
} from '../shop';
import { decodeNullableRewardState } from './reward-acquisition-codec';
import { rewardSourceResolvesAtAcquisition } from '../reward-state';

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
    expectExactKeys(rawOffer, ['optionKey', 'reward', 'anvilResult'], offerPath);
    const optionKey =
      rawOffer.optionKey === null
        ? null
        : expectString(rawOffer.optionKey, `${offerPath}.optionKey`);
    const reward = decodeShopInventoryReward(
      rawOffer.reward,
      catalog,
      `${offerPath}.reward`,
      profile.key,
    );
    if (reward === null) {
      if (rawOffer.anvilResult !== undefined)
        failProjectDocument(`${offerPath}.anvilResult`, 'requires a selected Anvil reward');
      if (optionKey !== null)
        failProjectDocument(`${offerPath}.optionKey`, 'requires a selected reward');
      offers[slot.key] = Object.freeze({ optionKey: null, reward: null });
      continue;
    }
    const offer = reward.offer;
    const group = profile.groups.byKey[slot.groupKey];
    if (group === undefined) {
      failProjectDocument(offerPath, `unknown shop group ${slot.groupKey}`);
    }
    const option = optionKey === null ? undefined : group.options.byKey[optionKey];
    if (optionKey !== null && option === undefined) {
      failProjectDocument(`${offerPath}.optionKey`, `unknown shop option ${optionKey}`);
    }
    if (option !== undefined && option.rewardType !== offer.rewardType) {
      failProjectDocument(
        `${offerPath}.optionKey`,
        `${optionKey} does not produce ${offer.rewardType}`,
      );
    }
    if (!group.options.values.some((option) => option.rewardType === offer.rewardType)) {
      failProjectDocument(
        `${offerPath}.reward.offer.rewardType`,
        `${offer.rewardType} is not available from ${slot.groupKey}`,
      );
    }
    const anvilResult = decodeAnvilResult(
      rawOffer.anvilResult,
      catalog,
      offer,
      `${offerPath}.anvilResult`,
    );
    offers[slot.key] = Object.freeze({
      optionKey,
      reward,
      ...(anvilResult === undefined ? {} : { anvilResult }),
    });
  }
  return Object.freeze({
    profileKey: profile.key,
    offers: Object.freeze(offers),
  });
}
