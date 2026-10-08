import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type {
  ConcreteAcquisitionDeclaration,
  RewardTypeDeclaration,
  ShopGroupDeclaration,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopSlotDeclaration,
  StygianWellGrant,
} from '@run-planner/engine/reward-kernel';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import type {
  RawRewardKernelInput,
  RawShopOptionEntryDeclaration,
} from '../../declarations/rewards/types';
import { normalizeAndValidateRequirement } from './requirements';
import { normalizeAcquisitionLifecycle } from './lifecycles';

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

function normalizeStygianWellGrant(raw: StygianWellGrant, path: string): StygianWellGrant {
  const kind = requireClosedValue(
    raw.kind,
    ['timedTrait', 'charge', 'consumable', 'ledger', 'immediate', 'twist'] as const,
    `${path}.kind`,
  );
  switch (raw.kind) {
    case 'timedTrait':
      return Object.freeze({
        kind,
        traitKey: requireNonEmpty(raw.traitKey, `${path}.traitKey`),
        initialUses: requirePositiveInteger(raw.initialUses, `${path}.initialUses`),
        clock: requireClosedValue(
          raw.clock,
          ['encounters', 'rooms', 'bosses'] as const,
          `${path}.clock`,
        ),
        ...(raw.publishedEffect === undefined
          ? {}
          : {
              publishedEffect: requireClosedValue(
                raw.publishedEffect,
                ['discount', 'emptySlot'] as const,
                `${path}.publishedEffect`,
              ),
            }),
      }) as StygianWellGrant;
    case 'charge':
      if (raw.charge === 'extended')
        return Object.freeze({
          kind: 'charge',
          charge: 'extended',
          eligibleItemKeys: freezeUniqueStrings(
            requireArray(raw.eligibleItemKeys, `${path}.eligibleItemKeys`) as readonly string[],
            `${path}.eligibleItemKeys`,
          ),
          bossExtension: requirePositiveInteger(raw.bossExtension, `${path}.bossExtension`),
        });
      if ('eligibleItemKeys' in raw || 'bossExtension' in raw)
        fail(path, 'only the extended charge declares eligible items and a boss extension');
      return Object.freeze({
        kind: 'charge',
        charge: requireClosedValue(
          raw.charge,
          ['spark', 'yarn', 'hymn'] as const,
          `${path}.charge`,
        ),
      });
    case 'consumable':
      return Object.freeze({
        kind: 'consumable',
        acquisitionGameName: requireNonEmpty(
          raw.acquisitionGameName,
          `${path}.acquisitionGameName`,
        ),
        ...(raw.publishedEffect === undefined
          ? {}
          : {
              publishedEffect: requireClosedValue(
                raw.publishedEffect,
                ['lastStand'] as const,
                `${path}.publishedEffect`,
              ),
            }),
      });
    case 'twist':
      return Object.freeze({
        kind: 'twist',
        pool: freezeUniqueStrings(
          requireArray(raw.pool, `${path}.pool`) as readonly string[],
          `${path}.pool`,
        ),
      });
    case 'ledger':
    case 'immediate':
      return Object.freeze({ kind: raw.kind });
  }
}

function normalizeShopOption(
  raw: RawShopOptionEntryDeclaration,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  resourceKeys: ReadonlySet<string>,
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
          grant: normalizeStygianWellGrant(raw.stygianWell.grant, `${path}.stygianWell.grant`),
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
          ...(raw.stygianWell.excludedRouteKeys === undefined
            ? {}
            : {
                excludedRouteKeys: freezeUniqueStrings(
                  raw.stygianWell.excludedRouteKeys,
                  `${path}.stygianWell.excludedRouteKeys`,
                ),
              }),
        });
  return Object.freeze({
    key: requireNonEmpty(raw.key, `${path}.key`),
    label: raw.label === undefined ? rewardType.label : requireNonEmpty(raw.label, `${path}.label`),
    rewardType: rewardType.gameName,
    ...(raw.requirement === undefined
      ? {}
      : {
          requirement: normalizeAndValidateRequirement(
            raw.requirement,
            rewardTypes,
            resourceKeys,
            `${path}.requirement`,
          ),
        }),
    ...(raw.purchaseRequirement === undefined
      ? {}
      : {
          purchaseRequirement: normalizeAndValidateRequirement(
            raw.purchaseRequirement,
            rewardTypes,
            resourceKeys,
            `${path}.purchaseRequirement`,
          ),
        }),
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
  resourceKeys: ReadonlySet<string>,
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
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
              normalizeShopOption(
                option,
                rewardTypes,
                resourceKeys,
                `${groupPath}.options[${optionIndex}]`,
              ),
            ),
            `${groupPath}.options`,
            (option) => option.key,
          );
          const groupRewardTypes = Object.freeze([
            ...new Set(options.values.map((option) => option.rewardType)),
          ]);
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
          if (
            reservedSupplementalKeys.has(slotKey) &&
            !(key === 'ZagPedestalOptions' && slotKey === 'infernalContractReward')
          )
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
          fail(path, 'every RoomShop option must declare its Stygian Well grant');
        validateRoomShopGrants(options, acquisitions, path);
      }
      return Object.freeze({ key, groups, slots, slotCount: slots.values.length });
    }),
    'shops',
    (shop) => shop.key,
  );
}

/**
 * Cross-option RoomShop grant rules: the Twist and Seal identities and their
 * references, and one self-gated encounter-clock timed trait per legality field.
 */
type TwistGrant = Extract<StygianWellGrant, { kind: 'twist' }>;
type SealGrant = Extract<StygianWellGrant, { charge: 'extended' }>;

interface WellOption {
  readonly key: string;
  readonly grant: StygianWellGrant;
  readonly selfGated: boolean;
}

const isTwistGrant = (grant: StygianWellGrant): grant is TwistGrant => grant.kind === 'twist';
const isSealGrant = (grant: StygianWellGrant): grant is SealGrant =>
  grant.kind === 'charge' && grant.charge === 'extended';

/** The single option holding a grant of this kind, under its native key. */
function requireSole<G extends StygianWellGrant>(
  options: readonly WellOption[],
  guard: (grant: StygianWellGrant) => grant is G,
  key: string,
  message: string,
  path: string,
): G {
  const matches = options.filter((option) => guard(option.grant));
  if (matches.length !== 1 || matches[0]!.key !== key) fail(path, message);
  return matches[0]!.grant as G;
}

/** Twist yields only ordinary RoomShop items, never another Twist or the Seal. */
function validateTwist(
  twist: TwistGrant,
  byKey: ReadonlyMap<string, StygianWellGrant>,
  path: string,
) {
  if (twist.pool.length === 0) fail(path, 'RandomStoreItem must declare a nonempty Twist pool');
  for (const itemKey of twist.pool) {
    const grant = byKey.get(itemKey);
    if (grant === undefined) fail(path, `Twist references unknown RoomShop item ${itemKey}`);
    if (isTwistGrant(grant) || isSealGrant(grant)) fail(path, `Twist cannot yield ${itemKey}`);
  }
}

/** The Seal extends only timed traits. */
function validateSeal(seal: SealGrant, byKey: ReadonlyMap<string, StygianWellGrant>, path: string) {
  if (seal.eligibleItemKeys.length === 0)
    fail(path, 'ExtendedShopTrait must declare nonempty eligible items');
  for (const itemKey of seal.eligibleItemKeys) {
    const grant = byKey.get(itemKey);
    if (grant === undefined) fail(path, `Extended references unknown RoomShop item ${itemKey}`);
    if (grant.kind !== 'timedTrait') fail(path, `Extended item ${itemKey} must be a timed trait`);
  }
}

/** A consumable grant names a consumable acquisition. */
function validateConsumableReferences(
  options: readonly WellOption[],
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
  path: string,
) {
  for (const { key, grant } of options) {
    if (grant.kind !== 'consumable') continue;
    if (acquisitions.byKey[grant.acquisitionGameName]?.kind !== 'consumable')
      fail(path, `${key} must reference a consumable acquisition`);
  }
}

/**
 * The inactive offer gate and a published timed effect come together, on an
 * encounter-clock trait, with one source per legality field.
 */
function validateLegalityGates(options: readonly WellOption[], path: string) {
  const sources = new Set<string>();
  for (const { key, grant, selfGated } of options) {
    if (!selfGated) {
      if (grant.kind === 'timedTrait' && grant.publishedEffect !== undefined)
        fail(path, `${key} published timed effect requires the inactive offer gate`);
      continue;
    }
    if (
      grant.kind !== 'timedTrait' ||
      grant.clock !== 'encounters' ||
      grant.publishedEffect === undefined
    )
      fail(path, `${key} inactive offer gate requires an encounter-clock published timed trait`);
    const field = grant.publishedEffect;
    if (sources.has(field)) fail(path, `Well legality field ${field} must have one source`);
    sources.add(field);
  }
}

function validateRoomShopGrants(
  entries: readonly ShopOptionEntry[],
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
  path: string,
): void {
  const options: readonly WellOption[] = entries.map((entry) => ({
    key: entry.key,
    grant: entry.stygianWell!.grant,
    selfGated: entry.stygianWell!.offerRequirements?.includes('inactive') === true,
  }));
  if (new Set(options.map((option) => option.key)).size !== options.length)
    fail(path, 'RoomShop option identities must be unique across groups');
  const byKey = new Map(options.map((option) => [option.key, option.grant]));
  const twist = requireSole(
    options,
    isTwistGrant,
    'RandomStoreItem',
    'RandomStoreItem must own the only Twist grant',
    path,
  );
  const seal = requireSole(
    options,
    isSealGrant,
    'ExtendedShopTrait',
    'ExtendedShopTrait must own the only extended charge',
    path,
  );
  validateTwist(twist, byKey, path);
  validateSeal(seal, byKey, path);
  validateConsumableReferences(options, acquisitions, path);
  validateLegalityGates(options, path);
}
