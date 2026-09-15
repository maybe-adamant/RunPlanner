import type { Catalog } from '../catalog-schema';
import type { ShopProfileDeclaration } from '../reward-kernel/model';
import type { ResolvedRewardOffer } from '../reward-kernel';
import type { AuthoredRewardState, RoomOccurrence, ShopOfferState, ShopState } from './model';
import type { AcquisitionSiteAddress } from './addresses';
import { acquisitionSiteStorageKey } from './acquisition/artificer';

export const INFERNAL_CONTRACT_ENTRY_KEY = 'infernalContractReward' as const;
export const TRAVEL_DEAL_REFILL_ENTRY_KEY = 'travelDealRefill' as const;
export const ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY = 'echoDoubleShopReward' as const;

/** The one persisted Shop-owner lookup for declared offers and Travel's dynamic refill slot. */
export function authoredShopOffer(
  occurrence: RoomOccurrence,
  offerKey: string,
): ShopOfferState | undefined {
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  if (shop === undefined) return undefined;
  return authoredShopOfferFromState(shop, offerKey);
}

export function authoredShopOfferFromState(
  shop: ShopState,
  offerKey: string,
): ShopOfferState | undefined {
  return offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ? shop.travelDealRefill : shop.offers[offerKey];
}

export function replaceAuthoredShopOffer(
  occurrence: RoomOccurrence,
  offerKey: string,
  offer: ShopOfferState,
): RoomOccurrence {
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined)
    throw new Error('Shop offer has no Shop owner');
  const shop = occurrence.state.shop;
  return Object.freeze({
    ...occurrence,
    state: Object.freeze({
      ...occurrence.state,
      shop: Object.freeze(
        offerKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
          ? { ...shop, travelDealRefill: offer }
          : { ...shop, offers: Object.freeze({ ...shop.offers, [offerKey]: offer }) },
      ),
    }),
  });
}

/** Resolves a persisted Shop slot to its declaration-owned generation cohort. */
export function shopSlotProfile(
  catalog: Catalog,
  roomGameName: string,
  hostProfileKey: string,
  offerKey: string,
): ShopProfileDeclaration | undefined {
  const profileKey =
    offerKey === INFERNAL_CONTRACT_ENTRY_KEY
      ? catalog.rooms.byKey[roomGameName]?.infernalContractReward?.generationProfileKey
      : hostProfileKey;
  return profileKey === undefined ? undefined : catalog.rewards.shops.byKey[profileKey];
}

export function echoShopDuplicateOffer(
  catalog: Catalog,
  source: ResolvedRewardOffer,
): ResolvedRewardOffer | null {
  const declaration = catalog.rewards.rewardTypes.byKey[source.rewardType];
  return declaration?.sourceResolution?.kind === 'acquisitionRole' ? null : source;
}

/** A hidden-source reward is freshly resolved by the duplicate acquisition;
 * all offer-resolved rewards retain the paid source's concrete identity. */
export function echoShopDuplicateOfferMatches(
  catalog: Catalog,
  source: ResolvedRewardOffer,
  duplicate: ResolvedRewardOffer,
): boolean {
  if (duplicate.rewardType !== source.rewardType) return false;
  const declaration = catalog.rewards.rewardTypes.byKey[source.rewardType];
  return (
    declaration?.sourceResolution?.kind === 'acquisitionRole' ||
    JSON.stringify(duplicate) === JSON.stringify(source)
  );
}

/** Gold creates loot through CreateLoot (exit-blocking), but its consumable
 * path does not register a required object. A box's later loot is not the box. */
export function echoShopDuplicateRequiresPickup(
  catalog: Catalog,
  offer: ResolvedRewardOffer,
): boolean {
  const resolution =
    catalog.rewards.rewardTypes.byKey[offer.rewardType]?.acquisitionRoles.values[0]?.resolution;
  if (resolution === undefined) return false;
  return (
    (resolution.kind === 'fixed' ? resolution.acquisition.kind : resolution.acquisitionKind) ===
    'loot'
  );
}

export function authoredAcquisitionEntry(
  _catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
): AuthoredRewardState | null | undefined {
  return occurrence.acquisitionSites?.roomExit?.pickupEntries?.[entryKey];
}

export function authoredAcquisitionEntryAtSite(
  occurrence: RoomOccurrence,
  site: AcquisitionSiteAddress,
  entryKey: string,
): AuthoredRewardState | null | undefined {
  return occurrence.acquisitionSites?.[acquisitionSiteStorageKey(site)]?.pickupEntries?.[entryKey];
}

export function replaceAuthoredAcquisitionEntryAtSite(
  occurrence: RoomOccurrence,
  site: AcquisitionSiteAddress,
  entryKey: string,
  value: AuthoredRewardState,
): RoomOccurrence {
  const siteKey = acquisitionSiteStorageKey(site);
  const current = occurrence.acquisitionSites?.[siteKey];
  if (current === undefined) throw new Error('acquisition entry has no exact site');
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      [siteKey]: Object.freeze({
        ...current,
        pickupEntries: Object.freeze({
          ...(current.pickupEntries ?? {}),
          [entryKey]: value,
        }),
      }),
    }),
  });
}

export function isShopSupplementalEntryKey(entryKey: string): boolean {
  return (
    entryKey === INFERNAL_CONTRACT_ENTRY_KEY ||
    entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
    entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
  );
}

export function replaceAuthoredAcquisitionEntry(
  occurrence: RoomOccurrence,
  entryKey: string,
  value: AuthoredRewardState,
): RoomOccurrence {
  const site = occurrence.acquisitionSites?.roomExit;
  if (site === undefined) throw new Error('acquisition entry has no roomExit site');
  return Object.freeze({
    ...occurrence,
    acquisitionSites: Object.freeze({
      ...(occurrence.acquisitionSites ?? {}),
      roomExit: Object.freeze({
        ...site,
        pickupEntries: Object.freeze({ ...(site.pickupEntries ?? {}), [entryKey]: value }),
      }),
    }),
  });
}
