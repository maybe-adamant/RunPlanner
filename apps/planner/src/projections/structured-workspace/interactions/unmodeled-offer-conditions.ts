import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ShopOptionEntry } from '@run-planner/engine/reward-kernel';

export type UnmodeledOfferCondition = NonNullable<ShopOptionEntry['unmodeledOfferCondition']>;

/**
 * The catalog's unmodeled offer condition on a shop profile's option, found by
 * its option key or by the reward type it stocks.
 */
export function shopOptionOfferCondition(
  catalog: Catalog,
  shopKey: string,
  match: { readonly optionKey: string } | { readonly rewardType: string },
): UnmodeledOfferCondition | undefined {
  const shop = catalog.rewards.shops.byKey[shopKey];
  if (shop === undefined) return undefined;
  for (const group of shop.groups.values) {
    for (const option of group.options.values) {
      const matches =
        'optionKey' in match
          ? option.key === match.optionKey
          : option.rewardType === match.rewardType;
      if (matches && option.unmodeledOfferCondition !== undefined)
        return option.unmodeledOfferCondition;
    }
  }
  return undefined;
}

/** Nemesis's free item is the Last Stand item only while the hero is missing one. */
export function nemesisFreeItemOfferCondition(
  catalog: Catalog,
  rewardType: string,
): UnmodeledOfferCondition | undefined {
  const freeItem =
    catalog.encounterDefinitions.byKey.NemesisRandomEvent?.nemesisRandomEvent?.freeItem;
  return freeItem?.conditionalResultRewardType === rewardType ? 'missingLastStand' : undefined;
}

/** An option's condition as an optional property. */
export function offerConditionProp(condition: UnmodeledOfferCondition | undefined): {
  readonly offerCondition?: UnmodeledOfferCondition;
} {
  return condition === undefined ? {} : { offerCondition: condition };
}

/** A chosen item's condition as an optional property of its interaction. */
export function selectedCondition(prop: { readonly offerCondition?: UnmodeledOfferCondition }): {
  readonly selectedOfferCondition?: UnmodeledOfferCondition;
} {
  return prop.offerCondition === undefined ? {} : { selectedOfferCondition: prop.offerCondition };
}
