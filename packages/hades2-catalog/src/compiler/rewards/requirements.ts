import type { CatalogCollection, RouteDeclaration } from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  RewardStoreDeclaration,
  RewardTypeDeclaration,
  RewardKernelCatalog,
} from '@run-planner/engine/reward-kernel';

import { createCollection, requireNonEmpty } from '../common';
import { fail } from '../errors';
import { normalizeRequirement, rejectEncounterHistoryRequirements } from '../requirements';
import type { RawRewardKernelInput } from '../../declarations/rewards/types';

function validateRequirementRewardReferences(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRequirementRewardReferences(child, rewardTypes, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      validateRequirementRewardReferences(
        requirement.requirement,
        rewardTypes,
        `${path}.requirement`,
      );
      return;
    case 'notInCurrentRoomShopOptions':
    case 'currentRoomRewardExcludes': {
      const values =
        requirement.kind === 'notInCurrentRoomShopOptions'
          ? [requirement.rewardType]
          : requirement.rewardTypes;
      values.forEach((value, index) => {
        if (rewardTypes.byKey[value] === undefined) {
          fail(`${path}.rewardTypes[${index}]`, `unknown reward type ${value}`);
        }
      });
      return;
    }
    case 'recordCount':
    case 'distinctRecordKeyCount':
    case 'counterRange':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'currentBatchRoomCount':
    case 'currentBatchTargetCount':
    case 'flagEquals':
    case 'minExits':
    case 'minRoomsSinceEvent':
    case 'recentEnvelopeSlotCount':
    case 'routeKeyEquals':
      return;
  }
}

function normalizeAndValidateRequirement(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): RequirementExpression {
  const normalized = normalizeRequirement(requirement, path);
  validateRequirementRewardReferences(normalized, rewardTypes, path);
  rejectEncounterHistoryRequirements(normalized, path);
  return normalized;
}

export function normalizeStores(
  raw: RawRewardKernelInput['stores'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<RewardStoreDeclaration> {
  return createCollection(
    raw.map((store, storeIndex): RewardStoreDeclaration => {
      const path = `stores[${storeIndex}]`;
      requireNonEmpty(store.key, `${path}.key`);
      if (store.entries.length === 0) {
        fail(`${path}.entries`, 'must not be empty');
      }
      const entries = store.entries.map((entry, entryIndex) => {
        const entryPath = `${path}.entries[${entryIndex}]`;
        if (rewardTypes.byKey[entry.rewardType] === undefined) {
          fail(`${entryPath}.rewardType`, `unknown reward type ${entry.rewardType}`);
        }
        return Object.freeze({
          index: entryIndex,
          rewardType: entry.rewardType,
          allowDuplicates: entry.allowDuplicates ?? false,
          ...(entry.requirement === undefined
            ? {}
            : {
                requirement: normalizeAndValidateRequirement(
                  entry.requirement,
                  rewardTypes,
                  `${entryPath}.requirement`,
                ),
              }),
        });
      });
      const interchangeableRewardTypes = store.interchangeableRewardTypes ?? [];
      const seenInterchangeableRewardTypes = new Set<string>();
      interchangeableRewardTypes.forEach((rewardType, rewardTypeIndex) => {
        const rewardTypePath = `${path}.interchangeableRewardTypes[${rewardTypeIndex}]`;
        requireNonEmpty(rewardType, rewardTypePath);
        if (seenInterchangeableRewardTypes.has(rewardType)) {
          fail(rewardTypePath, `duplicates reward type ${rewardType}`);
        }
        seenInterchangeableRewardTypes.add(rewardType);
        const matchingEntries = entries.filter((entry) => entry.rewardType === rewardType);
        if (matchingEntries.length < 2) {
          fail(rewardTypePath, `must identify at least two ${rewardType} entries in this store`);
        }
        if (new Set(matchingEntries.map((entry) => entry.allowDuplicates)).size > 1) {
          fail(rewardTypePath, `requires matching allowDuplicates values for ${rewardType}`);
        }
      });
      return Object.freeze({
        key: store.key,
        entries: Object.freeze(entries),
        ...(interchangeableRewardTypes.length === 0
          ? {}
          : { interchangeableRewardTypes: Object.freeze([...interchangeableRewardTypes]) }),
      });
    }),
    'stores',
    (store) => store.key,
  );
}

export { normalizeAndValidateRequirement };

function validateRouteRequirementReferences(
  requirement: RequirementExpression,
  routes: CatalogCollection<RouteDeclaration>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRouteRequirementReferences(child, routes, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      validateRouteRequirementReferences(requirement.requirement, routes, `${path}.requirement`);
      return;
    case 'routeKeyEquals':
      if (routes.byKey[requirement.routeKey] === undefined)
        fail(`${path}.routeKey`, `unknown route ${requirement.routeKey}`);
      return;
    default:
      return;
  }
}

/** Completes route identity references after route normalization breaks the reward/route cycle. */
export function validateRewardRouteRequirementReferences(
  rewards: RewardKernelCatalog,
  routes: CatalogCollection<RouteDeclaration>,
): void {
  rewards.stores.values.forEach((store) =>
    store.entries.forEach((entry, index) => {
      if (entry.requirement !== undefined)
        validateRouteRequirementReferences(
          entry.requirement,
          routes,
          `stores.${store.key}.entries[${index}].requirement`,
        );
    }),
  );
  rewards.shops.values.forEach((shop) =>
    shop.groups.values.forEach((group) =>
      group.options.values.forEach((option) => {
        if (option.requirement !== undefined)
          validateRouteRequirementReferences(
            option.requirement,
            routes,
            `shops.${shop.key}.groups.${group.key}.options.${option.key}.requirement`,
          );
        if (option.purchaseRequirement !== undefined)
          validateRouteRequirementReferences(
            option.purchaseRequirement,
            routes,
            `shops.${shop.key}.groups.${group.key}.options.${option.key}.purchaseRequirement`,
          );
      }),
    ),
  );
}
