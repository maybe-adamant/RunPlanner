import type {
  CatalogCollection,
  TraitDeclaration,
  TraitRequirementExpression,
  TraitSelectedDisposition,
} from '@run-planner/engine/catalog-schema';

import {
  freezeUniqueStrings,
  requireArray,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const ORDINARY_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;
const CONTEXTS = ['devotionNoDuo', 'blockGiftBoons', 'circeRemovableFearVow'] as const;
const SELECTED_DISPOSITIONS = [
  'equip',
  'directTraitSets',
  'advanceCurrentKeepsake',
  'producePickups',
  'noOp',
  'circe',
  'echo',
  'worldShopRestock',
  'naturalSelection',
  'ransom',
  'steadyGrowth',
  'seaStar',
] as const;

type RawTraitRequirement = {
  readonly kind: string;
  readonly requirements: readonly TraitRequirementExpression[];
  readonly traitKeys: readonly string[];
  readonly slot: unknown;
  readonly element: unknown;
  readonly minimum: number;
  readonly maximum?: number;
  readonly rarity: unknown;
  readonly context: unknown;
  readonly required: unknown;
};

function closedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

export function normalizeSelectedDisposition(
  raw: TraitSelectedDisposition | undefined,
  path: string,
): TraitSelectedDisposition {
  if (raw === undefined) return Object.freeze({ kind: 'equip' });
  const value = requireObject(raw, path) as {
    readonly kind?: unknown;
    readonly producerLifecycleKey?: unknown;
    readonly pickups?: unknown;
    readonly effect?: unknown;
    readonly excludedRewardTypes?: unknown;
    readonly excludedKeepsakeKeys?: unknown;
    readonly rankBonus?: unknown;
    readonly sets?: unknown;
    readonly refillCount?: unknown;
    readonly discountByRarity?: unknown;
    readonly slots?: unknown;
    readonly levelCount?: unknown;
    readonly removeGiverKey?: unknown;
    readonly buffGiverKey?: unknown;
    readonly levelsPerRemovedIdentity?: unknown;
    readonly intervalsByRarity?: unknown;
  };
  const kind = closedValue(value.kind, SELECTED_DISPOSITIONS, `${path}.kind`);
  if (kind === 'naturalSelection') {
    const slots = requireArray(value.slots, `${path}.slots`);
    const expected = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;
    if (
      Object.keys(value).length !== 3 ||
      value.levelCount !== 8 ||
      slots.length !== expected.length ||
      slots.some((slot, index) => slot !== expected[index])
    )
      fail(path, 'naturalSelection requires the exact five core slots and levelCount 8');
    return Object.freeze({
      kind,
      slots: Object.freeze([...expected]) as Extract<
        TraitSelectedDisposition,
        { readonly kind: 'naturalSelection' }
      >['slots'],
      levelCount: 8,
    });
  }
  if (kind === 'ransom') {
    if (Object.keys(value).length !== 4 || value.levelsPerRemovedIdentity !== 4)
      fail(path, 'ransom requires its two giver keys and level factor 4');
    const removeGiverKey = closedValue(
      value.removeGiverKey,
      ['Hera', 'Zeus'] as const,
      `${path}.removeGiverKey`,
    );
    const buffGiverKey = closedValue(
      value.buffGiverKey,
      ['Hera', 'Zeus'] as const,
      `${path}.buffGiverKey`,
    );
    if (removeGiverKey === buffGiverKey) fail(path, 'ransom givers must oppose each other');
    return Object.freeze({ kind, removeGiverKey, buffGiverKey, levelsPerRemovedIdentity: 4 });
  }
  if (kind === 'steadyGrowth') {
    if (Object.keys(value).length !== 2)
      fail(path, 'steadyGrowth requires only kind and intervalsByRarity');
    const intervals = requireObject(value.intervalsByRarity, `${path}.intervalsByRarity`);
    const expected = { Common: 6, Rare: 5, Epic: 4, Heroic: 3 } as const;
    if (
      Object.keys(intervals).length !== 4 ||
      Object.entries(expected).some(([rarity, interval]) => intervals[rarity] !== interval)
    )
      fail(
        `${path}.intervalsByRarity`,
        'must declare exact Common 6, Rare 5, Epic 4, Heroic 3 intervals',
      );
    return Object.freeze({ kind, intervalsByRarity: Object.freeze(expected) });
  }
  if (kind === 'seaStar') {
    if (Object.keys(value).length !== 1) fail(path, 'seaStar requires only kind');
    return Object.freeze({ kind });
  }
  if (kind === 'worldShopRestock') {
    if (Object.keys(value).length !== 3 || value.refillCount !== 1)
      fail(path, 'worldShopRestock requires kind, refillCount 1, and discountByRarity');
    const discounts = requireObject(value.discountByRarity, `${path}.discountByRarity`);
    const rarities = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
    if (
      Object.keys(discounts).length !== rarities.length ||
      rarities.some((rarity) => typeof discounts[rarity] !== 'number')
    )
      fail(`${path}.discountByRarity`, 'must declare exact Common, Rare, Epic, Heroic numbers');
    return Object.freeze({
      kind,
      refillCount: 1,
      discountByRarity: Object.freeze({
        Common: discounts.Common as number,
        Rare: discounts.Rare as number,
        Epic: discounts.Epic as number,
        Heroic: discounts.Heroic as number,
      }),
    });
  }
  if (kind === 'directTraitSets') {
    if (Object.keys(value).length !== 2) fail(path, 'directTraitSets requires only kind and sets');
    const expectedKeys = ['earth', 'fire', 'air', 'water'] as const;
    const sets = requireArray(value.sets, `${path}.sets`).map((entry, index) => {
      const set = requireObject(entry, `${path}.sets[${index}]`) as {
        readonly key?: unknown;
        readonly traitKeys?: unknown;
      };
      if (Object.keys(set).length !== 2)
        fail(`${path}.sets[${index}]`, 'must contain key and traitKeys');
      const key = closedValue(set.key, expectedKeys, `${path}.sets[${index}].key`);
      const traitKeys = freezeUniqueStrings(
        requireArray(set.traitKeys, `${path}.sets[${index}].traitKeys`) as readonly string[],
        `${path}.sets[${index}].traitKeys`,
      );
      if (traitKeys.length !== 2)
        fail(`${path}.sets[${index}].traitKeys`, 'must contain exactly two distinct traits');
      return Object.freeze({
        key,
        traitKeys: Object.freeze(traitKeys) as readonly [string, string],
      });
    });
    if (
      sets.length !== expectedKeys.length ||
      sets.some((set, index) => set.key !== expectedKeys[index])
    )
      fail(`${path}.sets`, 'must declare earth, fire, air, and water in source order');
    return Object.freeze({
      kind,
      sets: Object.freeze(sets) as Extract<
        TraitSelectedDisposition,
        { readonly kind: 'directTraitSets' }
      >['sets'],
    });
  }
  if (kind === 'advanceCurrentKeepsake') {
    if (Object.keys(value).length !== 2 || value.rankBonus !== 1)
      fail(path, 'advanceCurrentKeepsake requires only kind and rankBonus 1');
    return Object.freeze({ kind, rankBonus: 1 });
  }
  if (kind === 'circe') {
    if (Object.keys(value).length !== 2) fail(path, 'circe requires only kind and effect');
    return Object.freeze({
      kind,
      effect: closedValue(
        value.effect,
        ['activateArcana', 'promoteArcana', 'disableFear'] as const,
        `${path}.effect`,
      ),
    });
  }
  if (kind === 'echo') {
    const effect = closedValue(
      value.effect,
      [
        'numericNoOp',
        'survive',
        'doubleLevel',
        'lastRunBoon',
        'lastReward',
        'doubleShop',
        'repeatKeepsake',
      ] as const,
      `${path}.effect`,
    );
    if (effect === 'doubleShop') {
      if (Object.keys(value).length !== 3)
        fail(path, 'Echo doubleShop requires kind, effect, and excludedRewardTypes');
      const excludedRewardTypes = freezeUniqueStrings(
        requireArray(value.excludedRewardTypes, `${path}.excludedRewardTypes`) as string[],
        `${path}.excludedRewardTypes`,
      );
      if (excludedRewardTypes.length !== 1 || excludedRewardTypes[0] !== 'SpellDrop')
        fail(`${path}.excludedRewardTypes`, 'must equal [SpellDrop]');
      return Object.freeze({
        kind,
        effect,
        excludedRewardTypes,
      });
    }
    if (effect === 'repeatKeepsake') {
      if (Object.keys(value).length !== 3)
        fail(path, 'Echo repeatKeepsake requires kind, effect, and excludedKeepsakeKeys');
      const excludedKeepsakeKeys = freezeUniqueStrings(
        requireArray(value.excludedKeepsakeKeys, `${path}.excludedKeepsakeKeys`) as string[],
        `${path}.excludedKeepsakeKeys`,
      );
      const expected = [
        'AthenaEncounterKeepsake',
        'HadesAndPersephoneKeepsake',
        'EscalatingKeepsake',
        'FountainRarityKeepsake',
      ];
      if (
        excludedKeepsakeKeys.length !== expected.length ||
        expected.some((key) => !excludedKeepsakeKeys.includes(key))
      )
        fail(`${path}.excludedKeepsakeKeys`, 'must declare the four source exclusions');
      return Object.freeze({ kind, effect, excludedKeepsakeKeys });
    }
    if (Object.keys(value).length !== 2) fail(path, 'echo requires only kind and effect');
    return Object.freeze({ kind, effect });
  }
  if (kind !== 'producePickups') {
    if (Object.keys(value).length !== 1) fail(path, 'must contain only kind');
    return Object.freeze({ kind });
  }
  const pickups = requireArray(value.pickups, `${path}.pickups`).map((pickup, index) => {
    const entry = requireObject(pickup, `${path}.pickups[${index}]`) as {
      readonly key?: unknown;
      readonly rewardType?: unknown;
      readonly excludeStorySource?: unknown;
    };
    if (
      Object.keys(entry).length !== (entry.excludeStorySource === undefined ? 2 : 3) ||
      (entry.excludeStorySource !== undefined && entry.excludeStorySource !== true)
    )
      fail(
        `${path}.pickups[${index}]`,
        'must contain key, rewardType, and an optional true excludeStorySource',
      );
    if (typeof entry.key !== 'string' || typeof entry.rewardType !== 'string')
      fail(`${path}.pickups[${index}]`, 'key and rewardType must be strings');
    return Object.freeze({
      key: requireNonEmpty(entry.key, `${path}.pickups[${index}].key`),
      rewardType: requireNonEmpty(entry.rewardType, `${path}.pickups[${index}].rewardType`),
      ...(entry.excludeStorySource === true ? { excludeStorySource: true as const } : {}),
    });
  });
  if (
    pickups.length === 0 ||
    new Set(pickups.map((pickup) => pickup.key)).size !== pickups.length ||
    Object.keys(value).length !== 3
  )
    fail(path, 'producePickups requires a lifecycle and unique non-empty pickups');
  if (typeof value.producerLifecycleKey !== 'string')
    fail(`${path}.producerLifecycleKey`, 'must be a string');
  return Object.freeze({
    kind,
    producerLifecycleKey: requireNonEmpty(
      value.producerLifecycleKey,
      `${path}.producerLifecycleKey`,
    ),
    pickups: Object.freeze(pickups),
  });
}

export function normalizeRequirement(
  raw: TraitRequirementExpression,
  traits: CatalogCollection<TraitDeclaration>,
  deferred: ReadonlySet<string>,
  path: string,
): TraitRequirementExpression {
  if (typeof raw !== 'object' || raw === null) {
    fail(path, 'must be an object');
  }
  const requirement = raw as unknown as RawTraitRequirement;
  switch (requirement.kind) {
    case 'all':
      if (!Array.isArray(requirement.requirements)) {
        fail(`${path}.requirements`, 'must be an array');
      }
      if (requirement.requirements.length === 0) fail(path, 'must not be empty');
      return Object.freeze({
        kind: 'all',
        requirements: Object.freeze(
          requirement.requirements.map((child: TraitRequirementExpression, index: number) =>
            normalizeRequirement(child, traits, deferred, `${path}.requirements[${index}]`),
          ),
        ),
      });
    case 'settledSpellDrop':
      return Object.freeze({ kind: 'settledSpellDrop' as const });
    case 'anyEquippedTrait':
    case 'notEquippedTrait': {
      if (!Array.isArray(requirement.traitKeys)) {
        fail(`${path}.traitKeys`, 'must be an array');
      }
      const traitKeys = freezeUniqueStrings(requirement.traitKeys, `${path}.traitKeys`);
      for (const [index, traitKey] of traitKeys.entries()) {
        if (traits.byKey[traitKey] === undefined && !deferred.has(traitKey)) {
          fail(`${path}.traitKeys[${index}]`, `unknown trait operand ${traitKey}`);
        }
      }
      return Object.freeze({ kind: requirement.kind, traitKeys });
    }
    case 'elementCount':
      return Object.freeze({
        kind: 'elementCount',
        element: closedValue(requirement.element, ELEMENTS, `${path}.element`),
        minimum: requirePositiveInteger(requirement.minimum, `${path}.minimum`),
      });
    case 'highestBaseElementCount':
      return Object.freeze({
        kind: 'highestBaseElementCount',
        minimum: requirePositiveInteger(requirement.minimum, `${path}.minimum`),
      });
    case 'godBoonRarityCount':
      if (!Number.isInteger(requirement.minimum) || requirement.minimum < 0)
        fail(`${path}.minimum`, 'must be a non-negative integer');
      if (
        requirement.maximum !== undefined &&
        (!Number.isInteger(requirement.maximum) || requirement.maximum < requirement.minimum)
      ) {
        fail(`${path}.maximum`, 'must be an integer greater than or equal to minimum');
      }
      return Object.freeze({
        kind: 'godBoonRarityCount',
        rarity: closedValue(requirement.rarity, RARITIES, `${path}.rarity`),
        minimum: requirement.minimum,
        ...(requirement.maximum === undefined ? {} : { maximum: requirement.maximum }),
      });
    case 'rarifiableTrait':
    case 'upgradableTrait':
      return Object.freeze({ kind: requirement.kind });
    case 'ordinaryBoonSlotOccupied':
      return Object.freeze({
        kind: 'ordinaryBoonSlotOccupied',
        slot: closedValue(requirement.slot, ORDINARY_SLOTS, `${path}.slot`),
      });
    case 'offerContext':
      return Object.freeze({
        kind: 'offerContext',
        context: closedValue(requirement.context, CONTEXTS, `${path}.context`),
        required:
          typeof requirement.required === 'boolean'
            ? requirement.required
            : fail(`${path}.required`, 'must be boolean'),
      });
    case 'manualArcanaGraspCost':
      return Object.freeze({
        kind: 'manualArcanaGraspCost',
        minimum: requirePositiveInteger(requirement.minimum, `${path}.minimum`),
      });
    default:
      fail(`${path}.kind`, `unknown requirement kind ${String(requirement.kind)}`);
  }
}
