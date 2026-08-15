import type { Catalog } from '../catalog-schema';
import type { RequirementExpression } from '../requirements';
import type { ResolvedRewardOffer } from '../reward-kernel';
import type { AuthoredRewardState, RoomOccurrence, RouteWeaponAspectLoadout } from './model';
import { createDefaultAcquisitionRewardState } from './traits';

const ECHO_SHOP_DUPLICATE_PREFIX = 'echoDoubleShop:';

export function createEchoShopDuplicateEntryKey(offerKey: string): string {
  if (offerKey.length === 0) throw new Error('Echo Shop duplicate source key must not be empty');
  return `${ECHO_SHOP_DUPLICATE_PREFIX}${offerKey}`;
}

export function echoShopDuplicateSourceOfferKey(entryKey: string): string | undefined {
  if (!entryKey.startsWith(ECHO_SHOP_DUPLICATE_PREFIX)) return undefined;
  const offerKey = entryKey.slice(ECHO_SHOP_DUPLICATE_PREFIX.length);
  return offerKey.length === 0 ? undefined : offerKey;
}

export function echoShopDuplicateOffer(
  catalog: Catalog,
  source: ResolvedRewardOffer,
): ResolvedRewardOffer {
  const declaration = catalog.rewards.rewardTypes.byKey[source.rewardType];
  if (declaration?.sourceResolution?.kind !== 'acquisitionRole') return source;
  return Object.freeze({
    rewardType: source.rewardType,
    ...(declaration.defaultPayload === undefined ? {} : { payload: declaration.defaultPayload }),
  });
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

/** Declaration-complete fresh detail for one derived duplicate of an authored Shop offer. */
export function createDefaultEchoShopDuplicateEntry(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
  loadout: RouteWeaponAspectLoadout,
): AuthoredRewardState | undefined {
  const offerKey = echoShopDuplicateSourceOfferKey(entryKey);
  const shop = occurrence.state.kind === 'shop' ? occurrence.state.shop : undefined;
  const source = offerKey === undefined ? undefined : shop?.offers[offerKey]?.reward;
  if (shop === undefined || source === undefined) return undefined;
  return createDefaultAcquisitionRewardState(
    catalog,
    echoShopDuplicateOffer(catalog, source.offer),
    loadout,
    {
      kind: 'shopProfile',
      key: shop.profileKey,
    },
  );
}

export function authoredAcquisitionEntry(
  catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
  loadout: RouteWeaponAspectLoadout,
): AuthoredRewardState | undefined {
  return (
    occurrence.acquisitionSites?.roomExit?.pickupEntries?.[entryKey] ??
    createDefaultEchoShopDuplicateEntry(catalog, occurrence, entryKey, loadout)
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

function requirementUsesDeathDefianceCondition(
  requirement: RequirementExpression | undefined,
): boolean {
  if (requirement === undefined) return false;
  switch (requirement.kind) {
    case 'all':
    case 'any':
      return requirement.requirements.some(requirementUsesDeathDefianceCondition);
    case 'not':
      return requirementUsesDeathDefianceCondition(requirement.requirement);
    case 'authoredCondition':
      return requirement.condition === 'deathDefianceConditionMet';
    default:
      return false;
  }
}

/** Engine-owned authoring query for the one source-local Shop condition. */
export function shopProfileUsesDeathDefianceCondition(
  catalog: Catalog,
  profileKey: string,
): boolean {
  const profile = catalog.rewards.shops.byKey[profileKey];
  return (
    profile?.groups.values.some((group) =>
      group.options.values.some(
        (option) =>
          requirementUsesDeathDefianceCondition(option.requirement) ||
          requirementUsesDeathDefianceCondition(option.purchaseRequirement),
      ),
    ) ?? false
  );
}
