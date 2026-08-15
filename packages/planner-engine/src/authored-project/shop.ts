import type { Catalog } from '../catalog-schema';
import type { RequirementExpression } from '../requirements';
import type { ResolvedRewardOffer } from '../reward-kernel';
import type { AuthoredRewardState, RoomOccurrence, RouteWeaponAspectLoadout } from './model';
import { createDefaultAcquisitionRewardState } from './traits';

const ECHO_SHOP_DUPLICATE_PREFIX = 'echoDoubleShop:';
export const INFERNAL_CONTRACT_ENTRY_KEY = 'infernalContractReward' as const;
export const TRAVEL_DEAL_REFILL_ENTRY_KEY = 'travelDealRefill' as const;

export function createDefaultInfernalContractEntries(
  catalog: Catalog,
  roomGameName: string,
  loadout: RouteWeaponAspectLoadout,
): Readonly<Record<string, AuthoredRewardState>> {
  const descriptor = catalog.rooms.byKey[roomGameName]?.infernalContractReward;
  if (descriptor === undefined) return Object.freeze({});
  const rewardType = catalog.rewards.rewardTypes.byKey[descriptor.defaultRewardType];
  if (rewardType === undefined)
    throw new Error(`unknown contract reward ${descriptor.defaultRewardType}`);
  return Object.freeze({
    [descriptor.entryKey]: createDefaultAcquisitionRewardState(
      catalog,
      Object.freeze({
        rewardType: rewardType.gameName,
        ...(rewardType.defaultPayload === undefined ? {} : { payload: rewardType.defaultPayload }),
      }),
      loadout,
      { kind: 'producerLifecycle', key: descriptor.producerLifecycleKey },
    ),
  });
}

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

/** Exact paid Shop source eligible to own an Echo duplicate. */
export function echoShopDuplicateSourceReward(
  occurrence: RoomOccurrence,
  sourceKey: string,
): AuthoredRewardState | undefined {
  if (occurrence.state.kind !== 'shop' || occurrence.state.shop === undefined) return undefined;
  const initial = occurrence.state.shop.offers[sourceKey]?.reward;
  if (initial !== undefined) return initial;
  return sourceKey === TRAVEL_DEAL_REFILL_ENTRY_KEY
    ? occurrence.acquisitionSites?.roomExit?.pickupEntries?.[sourceKey]
    : undefined;
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
  const source =
    offerKey === undefined ? undefined : echoShopDuplicateSourceReward(occurrence, offerKey);
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

export function isShopSupplementalEntryKey(entryKey: string): boolean {
  return (
    entryKey === INFERNAL_CONTRACT_ENTRY_KEY ||
    entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
    echoShopDuplicateSourceOfferKey(entryKey) !== undefined
  );
}

/** Complete Shop chronology proposals, including the singleton refill's source dependency. */
export function shopAcquisitionOrderProposals(
  order: readonly string[],
  activeEntryKeys: readonly string[],
  travelSourceOfferKey?: string,
): readonly (readonly string[])[] {
  const proposals: string[][] = [[...order]];
  for (const entryKey of activeEntryKeys) {
    const index = order.indexOf(entryKey);
    if (index >= 0) {
      proposals.push(
        order.filter(
          (candidate) =>
            candidate !== entryKey &&
            !(entryKey === travelSourceOfferKey && candidate === TRAVEL_DEAL_REFILL_ENTRY_KEY),
        ),
      );
      continue;
    }
    if (entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY) {
      const sourceIndex =
        travelSourceOfferKey === undefined ? -1 : order.indexOf(travelSourceOfferKey);
      if (sourceIndex >= 0) {
        proposals.push([
          ...order.slice(0, sourceIndex + 1),
          TRAVEL_DEAL_REFILL_ENTRY_KEY,
          ...order.slice(sourceIndex + 1),
        ]);
      }
      continue;
    }
    proposals.push([...order, entryKey]);
  }
  for (let index = 0; index < order.length - 1; index += 1) {
    const swapped = [...order];
    [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
    const refillIndex = swapped.indexOf(TRAVEL_DEAL_REFILL_ENTRY_KEY);
    const sourceIndex =
      travelSourceOfferKey === undefined ? -1 : swapped.indexOf(travelSourceOfferKey);
    if (refillIndex >= 0 && (sourceIndex < 0 || refillIndex <= sourceIndex)) continue;
    proposals.push(swapped);
  }
  const seen = new Set<string>();
  return Object.freeze(
    proposals.flatMap((proposal) => {
      const key = JSON.stringify(proposal);
      if (seen.has(key)) return [];
      seen.add(key);
      return [Object.freeze(proposal)];
    }),
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
