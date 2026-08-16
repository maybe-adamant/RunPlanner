import type { Catalog } from '../catalog-schema';
import type { RequirementExpression } from '../requirements';
import type { ResolvedRewardOffer } from '../reward-kernel';
import type { AuthoredRewardState, RoomOccurrence, RouteWeaponAspectLoadout } from './model';
import { createDefaultAcquisitionRewardState } from './traits';

export const INFERNAL_CONTRACT_ENTRY_KEY = 'infernalContractReward' as const;
export const TRAVEL_DEAL_REFILL_ENTRY_KEY = 'travelDealRefill' as const;
export const ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY = 'echoDoubleShopReward' as const;

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

export function authoredAcquisitionEntry(
  _catalog: Catalog,
  occurrence: RoomOccurrence,
  entryKey: string,
): AuthoredRewardState | undefined {
  return occurrence.acquisitionSites?.roomExit?.pickupEntries?.[entryKey];
}

export function isShopSupplementalEntryKey(entryKey: string): boolean {
  return (
    entryKey === INFERNAL_CONTRACT_ENTRY_KEY ||
    entryKey === TRAVEL_DEAL_REFILL_ENTRY_KEY ||
    entryKey === ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY
  );
}

export type DerivedShopEntryDependency =
  | {
      readonly kind: 'fixedSource';
      readonly entryKey: typeof TRAVEL_DEAL_REFILL_ENTRY_KEY;
      readonly sourceOfferKey: string;
    }
  | {
      readonly kind: 'firstEligibleSource';
      readonly entryKey: typeof ECHO_DOUBLE_SHOP_REWARD_ENTRY_KEY;
      readonly eligibleSourceOfferKeys: readonly string[];
    };

function normalizeDerivedShopEntryOrder(
  proposed: readonly string[],
  dependencies: readonly DerivedShopEntryDependency[],
): readonly string[] {
  let normalized = [...proposed];
  for (const dependency of dependencies) {
    const entryIndex = normalized.indexOf(dependency.entryKey);
    if (entryIndex < 0) continue;
    const sourceOfferKey =
      dependency.kind === 'fixedSource'
        ? dependency.sourceOfferKey
        : normalized.find(
            (entryKey) =>
              entryKey !== dependency.entryKey &&
              dependency.eligibleSourceOfferKeys.includes(entryKey),
          );
    const sourceIndex = sourceOfferKey === undefined ? -1 : normalized.indexOf(sourceOfferKey);
    if (sourceIndex < 0) {
      normalized = normalized.filter((entryKey) => entryKey !== dependency.entryKey);
      continue;
    }
    const currentIndex = normalized.indexOf(dependency.entryKey);
    if (currentIndex > sourceIndex) continue;
    normalized.splice(currentIndex, 1);
    const reboundSourceIndex = normalized.indexOf(sourceOfferKey!);
    normalized.splice(reboundSourceIndex + 1, 0, dependency.entryKey);
  }
  return Object.freeze(normalized);
}

/** Complete Shop chronology proposals over every active derived-entry dependency. */
export function shopAcquisitionOrderProposals(
  order: readonly string[],
  activeEntryKeys: readonly string[],
  dependencies: readonly DerivedShopEntryDependency[] = Object.freeze([]),
): readonly (readonly string[])[] {
  const proposals: (readonly string[])[] = [normalizeDerivedShopEntryOrder(order, dependencies)];
  for (const entryKey of activeEntryKeys) {
    const index = order.indexOf(entryKey);
    if (index >= 0) {
      proposals.push(
        normalizeDerivedShopEntryOrder(
          order.filter((candidate) => candidate !== entryKey),
          dependencies,
        ),
      );
      continue;
    }
    proposals.push(normalizeDerivedShopEntryOrder([...order, entryKey], dependencies));
  }
  for (let index = 0; index < order.length - 1; index += 1) {
    const swapped = [...order];
    [swapped[index], swapped[index + 1]] = [swapped[index + 1]!, swapped[index]!];
    proposals.push(normalizeDerivedShopEntryOrder(swapped, dependencies));
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
