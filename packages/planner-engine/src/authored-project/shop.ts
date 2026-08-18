import type { Catalog } from '../catalog-schema';
import type { RequirementExpression } from '../requirements';
import type { ResolvedRewardOffer } from '../reward-kernel';
import type { AuthoredRewardState, RoomOccurrence } from './model';
import type { AcquisitionSiteAddress } from './addresses';
import { acquisitionSiteStorageKey } from './artificer';

export const INFERNAL_CONTRACT_ENTRY_KEY = 'infernalContractReward' as const;
export const TRAVEL_DEAL_REFILL_ENTRY_KEY = 'travelDealRefill' as const;
export const ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY = 'echoDoubleShopReward' as const;

export function createInfernalContractEntries(
  catalog: Catalog,
  roomGameName: string,
): Readonly<Record<string, AuthoredRewardState | null>> {
  const descriptor = catalog.rooms.byKey[roomGameName]?.infernalContractReward;
  if (descriptor === undefined) return Object.freeze({});
  return Object.freeze({ [descriptor.entryKey]: null });
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
