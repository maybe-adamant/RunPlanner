import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type {
  RewardTypeDeclaration,
  ShopGroupDeclaration,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopSlotDeclaration,
} from '@run-planner/engine/reward-kernel';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import type {
  RawRewardKernelInput,
  RawShopOptionEntryDeclaration,
} from '../../declarations/rewards/types';
import { normalizeAndValidateRequirement } from './requirements';
import { normalizeAcquisitionLifecycle } from './lifecycles';

const STYGIAN_WELL_EFFECTS = [
  'neutral',
  'spark',
  'yarn',
  'hymn',
  'discount',
  'emptySlot',
  'extended',
  'twist',
  'lastStand',
] as const;
const STYGIAN_WELL_OFFER_REQUIREMENTS = ['inactive', 'emptyAttackOrSpecial'] as const;

function requireClosedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

function normalizeShopOption(
  raw: RawShopOptionEntryDeclaration,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): ShopOptionEntry {
  const boonRarityOverride = raw.boonRarityOverride;
  if (boonRarityOverride !== undefined) {
    for (const [key, value] of Object.entries(boonRarityOverride)) {
      if (
        !['Rare', 'Epic', 'Duo', 'Legendary'].includes(key) ||
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        fail(`${path}.boonRarityOverride.${key}`, 'must be a finite supported boon rarity check');
      }
    }
  }
  const rewardType = rewardTypes.byKey[raw.rewardType];
  if (rewardType === undefined) {
    fail(`${path}.rewardType`, `unknown reward type ${raw.rewardType}`);
  }
  const acquisitionLifecycle = normalizeAcquisitionLifecycle(
    raw.acquisitionLifecycle,
    rewardType,
    'purchase',
    path,
  );
  const rawInteraction = raw.purchaseInteraction;
  if (rawInteraction === undefined) fail(`${path}.purchaseInteraction`, 'is required');
  const purchaseInteraction =
    rawInteraction.kind === 'resolvedOfferSource'
      ? Object.freeze({ kind: 'resolvedOfferSource' as const })
      : rawInteraction.kind === 'fixed'
        ? Object.freeze({
            kind: 'fixed' as const,
            gameName: requireNonEmpty(
              rawInteraction.gameName,
              `${path}.purchaseInteraction.gameName`,
            ),
          })
        : fail(`${path}.purchaseInteraction.kind`, 'must be fixed or resolvedOfferSource');
  if (
    purchaseInteraction.kind === 'resolvedOfferSource' &&
    rewardType.sourceResolution?.kind !== 'offer'
  ) {
    fail(
      `${path}.purchaseInteraction`,
      'resolvedOfferSource requires offer-time source resolution',
    );
  }
  const stygianWell =
    raw.stygianWell === undefined
      ? undefined
      : Object.freeze({
          effect: requireClosedValue(
            raw.stygianWell.effect,
            STYGIAN_WELL_EFFECTS,
            `${path}.stygianWell.effect`,
          ),
          ...(raw.stygianWell.offerRequirements === undefined
            ? {}
            : {
                offerRequirements: (() => {
                  const values = requireArray(
                    raw.stygianWell.offerRequirements,
                    `${path}.stygianWell.offerRequirements`,
                  ).map((requirement, index) =>
                    requireClosedValue(
                      requirement,
                      STYGIAN_WELL_OFFER_REQUIREMENTS,
                      `${path}.stygianWell.offerRequirements[${index}]`,
                    ),
                  );
                  if (new Set(values).size !== values.length)
                    fail(`${path}.stygianWell.offerRequirements`, 'must not contain duplicates');
                  return Object.freeze(values);
                })(),
              }),
          ...(raw.stygianWell.nestedResultItemKeys === undefined
            ? {}
            : {
                nestedResultItemKeys: freezeUniqueStrings(
                  requireArray(
                    raw.stygianWell.nestedResultItemKeys,
                    `${path}.stygianWell.nestedResultItemKeys`,
                  ) as readonly string[],
                  `${path}.stygianWell.nestedResultItemKeys`,
                ),
              }),
          ...(raw.stygianWell.nestedRuntimeOfferFallbacks === undefined
            ? {}
            : {
                nestedRuntimeOfferFallbacks: Object.freeze(
                  requireArray(
                    raw.stygianWell.nestedRuntimeOfferFallbacks,
                    `${path}.stygianWell.nestedRuntimeOfferFallbacks`,
                  ).map((rawEdge, index) => {
                    const edge = requireObject(
                      rawEdge,
                      `${path}.stygianWell.nestedRuntimeOfferFallbacks[${index}]`,
                    );
                    return Object.freeze({
                      preferredItemKey: requireNonEmpty(
                        edge.preferredItemKey as string,
                        `${path}.stygianWell.nestedRuntimeOfferFallbacks[${index}].preferredItemKey`,
                      ),
                      fallbackItemKey: requireNonEmpty(
                        edge.fallbackItemKey as string,
                        `${path}.stygianWell.nestedRuntimeOfferFallbacks[${index}].fallbackItemKey`,
                      ),
                    });
                  }),
                ),
              }),
          ...(raw.stygianWell.extendedDirectPurchaseItemKeys === undefined
            ? {}
            : {
                extendedDirectPurchaseItemKeys: freezeUniqueStrings(
                  requireArray(
                    raw.stygianWell.extendedDirectPurchaseItemKeys,
                    `${path}.stygianWell.extendedDirectPurchaseItemKeys`,
                  ) as readonly string[],
                  `${path}.stygianWell.extendedDirectPurchaseItemKeys`,
                ),
              }),
        });
  return Object.freeze({
    key: requireNonEmpty(raw.key, `${path}.key`),
    rewardType: rewardType.gameName,
    ...(raw.requirement === undefined
      ? {}
      : {
          requirement: normalizeAndValidateRequirement(
            raw.requirement,
            rewardTypes,
            `${path}.requirement`,
          ),
        }),
    ...(raw.purchaseRequirement === undefined
      ? {}
      : {
          purchaseRequirement: normalizeAndValidateRequirement(
            raw.purchaseRequirement,
            rewardTypes,
            `${path}.purchaseRequirement`,
          ),
        }),
    ...(raw.runtimeOfferFallbackRewardTypes === undefined
      ? {}
      : (() => {
          const values = freezeUniqueStrings(
            requireArray(
              raw.runtimeOfferFallbackRewardTypes,
              `${path}.runtimeOfferFallbackRewardTypes`,
            ) as readonly string[],
            `${path}.runtimeOfferFallbackRewardTypes`,
          );
          if (values.length === 0)
            fail(`${path}.runtimeOfferFallbackRewardTypes`, 'must not be empty');
          if (values.some((rewardType) => rewardTypes.byKey[rewardType] === undefined))
            fail(`${path}.runtimeOfferFallbackRewardTypes`, 'contains an unknown reward type');
          return { runtimeOfferFallbackRewardTypes: values };
        })()),
    ...(raw.runtimeOfferRequirement === undefined
      ? {}
      : raw.runtimeOfferRequirement === 'missingLastStand'
        ? { runtimeOfferRequirement: 'missingLastStand' as const }
        : fail(`${path}.runtimeOfferRequirement`, 'has an unknown runtime offer requirement')),
    acquisitionLifecycle,
    purchaseInteraction,
    ...(boonRarityOverride === undefined
      ? {}
      : { boonRarityOverride: Object.freeze({ ...boonRarityOverride }) }),
    ...(stygianWell === undefined ? {} : { stygianWell }),
  });
}

export function normalizeShops(
  raw: RawRewardKernelInput['shops'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ShopProfileDeclaration> {
  const echoDuplicateKeyPrefix = 'echoDoubleShop:';
  const reservedSupplementalKeys = new Set([
    'infernalContractReward',
    'travelDealRefill',
    'echoDoubleShopReward',
  ]);
  return createCollection(
    raw.map((profile, profileIndex): ShopProfileDeclaration => {
      const path = `shops[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      if (profile.groups.length === 0) fail(`${path}.groups`, 'must not be empty');
      const groups = createCollection(
        profile.groups.map((group, groupIndex): ShopGroupDeclaration => {
          const groupPath = `${path}.groups[${groupIndex}]`;
          const offerCount = requirePositiveInteger(group.offerCount, `${groupPath}.offerCount`);
          if (offerCount > group.options.length)
            fail(`${groupPath}.offerCount`, 'cannot exceed the number of option entries');
          const options = createCollection(
            group.options.map((option, optionIndex) =>
              normalizeShopOption(option, rewardTypes, `${groupPath}.options[${optionIndex}]`),
            ),
            `${groupPath}.options`,
            (option) => option.key,
          );
          const groupRewardTypes = Object.freeze([
            ...new Set(options.values.map((option) => option.rewardType)),
          ]);
          for (const option of options.values) {
            const fallbacks = option.runtimeOfferFallbackRewardTypes;
            if (fallbacks === undefined) continue;
            if (fallbacks.some((rewardType) => !groupRewardTypes.includes(rewardType)))
              fail(
                `${groupPath}.options.${option.key}.runtimeOfferFallbackRewardTypes`,
                'must remain in the exact Shop group',
              );
          }
          return Object.freeze({
            key: requireNonEmpty(group.key, `${groupPath}.key`),
            offerCount,
            options,
            rewardTypes: groupRewardTypes,
          });
        }),
        `${path}.groups`,
        (group) => group.key,
      );
      const expectedGroupKeys = groups.values.flatMap((group) =>
        Array.from({ length: group.offerCount }, () => group.key),
      );
      if (profile.slots.length !== expectedGroupKeys.length)
        fail(`${path}.slots`, `must declare exactly ${expectedGroupKeys.length} emitted slots`);
      const slots = createCollection(
        profile.slots.map((slot, slotIndex): ShopSlotDeclaration => {
          const slotPath = `${path}.slots[${slotIndex}]`;
          const groupKey = requireNonEmpty(slot.groupKey, `${slotPath}.groupKey`);
          const expectedGroupKey = expectedGroupKeys[slotIndex];
          if (groupKey !== expectedGroupKey)
            fail(`${slotPath}.groupKey`, `expected ${String(expectedGroupKey)}`);
          const group = groups.byKey[groupKey];
          if (group === undefined) fail(`${slotPath}.groupKey`, `unknown shop group ${groupKey}`);
          const slotKey = requireNonEmpty(slot.key, `${slotPath}.key`);
          if (slotKey.startsWith(echoDuplicateKeyPrefix))
            fail(`${slotPath}.key`, `must not use reserved prefix ${echoDuplicateKeyPrefix}`);
          if (reservedSupplementalKeys.has(slotKey))
            fail(`${slotPath}.key`, `must not use reserved supplemental key ${slotKey}`);
          return Object.freeze({
            key: slotKey,
            label: requireNonEmpty(slot.label, `${slotPath}.label`),
            groupKey,
          });
        }),
        `${path}.slots`,
        (slot) => slot.key,
      );
      const options = groups.values.flatMap((group) => group.options.values);
      if (key !== 'RoomShop') {
        if (options.some((option) => option.stygianWell !== undefined))
          fail(path, 'Stygian Well metadata is permitted only on RoomShop options');
      } else {
        if (options.some((option) => option.stygianWell === undefined))
          fail(path, 'every RoomShop option must declare its Stygian Well identity and effect');
        const optionKeys = options.map((option) => option.key);
        if (new Set(optionKeys).size !== optionKeys.length)
          fail(path, 'RoomShop option identities must be unique across groups');
        const known = new Set(optionKeys);
        const twist = options.find((option) => option.key === 'RandomStoreItem');
        const extended = options.find((option) => option.key === 'ExtendedShopTrait');
        for (const option of options) {
          const metadata = option.stygianWell!;
          if (
            option.key !== 'RandomStoreItem' &&
            (metadata.nestedResultItemKeys !== undefined ||
              metadata.nestedRuntimeOfferFallbacks !== undefined)
          )
            fail(path, 'nested Well metadata is owned only by RandomStoreItem');
          if (
            option.key !== 'ExtendedShopTrait' &&
            metadata.extendedDirectPurchaseItemKeys !== undefined
          )
            fail(path, 'extended Well metadata is owned only by ExtendedShopTrait');
        }
        if (twist?.stygianWell?.effect !== 'twist')
          fail(path, 'RandomStoreItem must own the Twist effect');
        if (extended?.stygianWell?.effect !== 'extended')
          fail(path, 'ExtendedShopTrait must own the Extended effect');
        const nestedResultItemKeys = twist.stygianWell.nestedResultItemKeys ?? [];
        const nestedFallbacks = twist.stygianWell.nestedRuntimeOfferFallbacks ?? [];
        const extendedDirectPurchaseItemKeys =
          extended.stygianWell.extendedDirectPurchaseItemKeys ?? [];
        if (nestedResultItemKeys.length === 0)
          fail(path, 'RandomStoreItem must declare a nonempty Twist result pool');
        if (nestedFallbacks.length === 0)
          fail(path, 'RandomStoreItem must declare its nonempty nested fallback policy');
        if (extendedDirectPurchaseItemKeys.length === 0)
          fail(path, 'ExtendedShopTrait must declare a nonempty direct-purchase whitelist');
        const twistPool = new Set(nestedResultItemKeys);
        for (const itemKey of twistPool)
          if (!known.has(itemKey)) fail(path, `Twist references unknown RoomShop item ${itemKey}`);
        if (
          new Set(nestedFallbacks.map((edge) => edge.preferredItemKey)).size !==
          nestedFallbacks.length
        )
          fail(path, 'Twist fallback preferred item keys must be unique');
        for (const edge of nestedFallbacks)
          if (!twistPool.has(edge.preferredItemKey) || !twistPool.has(edge.fallbackItemKey))
            fail(path, 'Twist fallback endpoints must both belong to the Twist result pool');
        for (const itemKey of extendedDirectPurchaseItemKeys)
          if (!known.has(itemKey))
            fail(path, `Extended references unknown RoomShop item ${itemKey}`);
      }
      return Object.freeze({ key, groups, slots, slotCount: slots.values.length });
    }),
    'shops',
    (shop) => shop.key,
  );
}
