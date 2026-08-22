import type {
  AspectDeclaration,
  CatalogCollection,
  HammerCompatibility,
  TraitCatalog,
  TraitDeclaration,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  TraitRequirementExpression,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitSelectedDisposition,
  TraitElement,
  EchoLastRunBoonCatalog,
  TraitRarity,
  WeaponDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireBoolean,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import type {
  RawAspectDeclaration,
  RawTraitCatalogInput,
  RawTraitDeclaration,
  RawTraitGiverDeclaration,
  RawWeaponDeclaration,
} from '../declarations/traits';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const IN_RUN_RARITIES = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
const FRESH_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const;
const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const EQUIPMENT_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'] as const;
const BASE_ELEMENTS = ['Earth', 'Air', 'Fire', 'Water'] as const;
const CALLING_CARD_GIVERS = new Set([
  'Zeus',
  'Hera',
  'Poseidon',
  'Demeter',
  'Apollo',
  'Aphrodite',
  'Hephaestus',
  'Hestia',
  'Ares',
  'Hermes',
  'Artemis',
  'Athena',
  'Dionysus',
]);
const ORDINARY_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;
const BOON_RARITY_PROVIDER_KINDS = ['olympian', 'hermes'] as const;
const BOON_RARITY_CHECKS = ['Rare', 'Epic', 'Duo', 'Legendary'] as const;
const CONTEXTS = [
  'devotionNoDuo',
  'blockGiftBoons',
  'deathDefianceConditionMet',
  'circeRemovableFearVow',
] as const;
const SELECTED_DISPOSITIONS = [
  'equip',
  'directTraitSets',
  'advanceCurrentKeepsake',
  'producePickups',
  'noOp',
  'circe',
  'echo',
  'worldShopRestock',
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

function normalizeBoonRarityBases(
  raw: RawTraitCatalogInput['boonRarityBases'],
): TraitCatalog['boonRarityBases'] {
  const bases = requireObject(raw, 'boonRarityBases');
  if (
    Object.keys(bases).length !== BOON_RARITY_PROVIDER_KINDS.length ||
    BOON_RARITY_PROVIDER_KINDS.some((providerKind) => bases[providerKind] === undefined)
  )
    fail('boonRarityBases', 'must declare exactly olympian and hermes provider bases');
  const normalized = Object.fromEntries(
    BOON_RARITY_PROVIDER_KINDS.map((providerKind) => {
      const value = requireObject(bases[providerKind], `boonRarityBases.${providerKind}`);
      if (
        Object.keys(value).length !== BOON_RARITY_CHECKS.length ||
        BOON_RARITY_CHECKS.some((check) => value[check] === undefined)
      )
        fail(
          `boonRarityBases.${providerKind}`,
          'must declare exact Rare, Epic, Duo, and Legendary checks',
        );
      const checks = Object.fromEntries(
        BOON_RARITY_CHECKS.map((check) => {
          const chance = value[check];
          if (typeof chance !== 'number' || !Number.isFinite(chance))
            fail(`boonRarityBases.${providerKind}.${check}`, 'must be a finite number');
          return [check, chance];
        }),
      );
      return [providerKind, Object.freeze(checks)];
    }),
  );
  return Object.freeze(normalized) as TraitCatalog['boonRarityBases'];
}

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

function normalizeSelectedDisposition(
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
  };
  const kind = closedValue(value.kind, SELECTED_DISPOSITIONS, `${path}.kind`);
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
    };
    if (Object.keys(entry).length !== 2)
      fail(`${path}.pickups[${index}]`, 'must contain key and rewardType');
    if (typeof entry.key !== 'string' || typeof entry.rewardType !== 'string')
      fail(`${path}.pickups[${index}]`, 'key and rewardType must be strings');
    return Object.freeze({
      key: requireNonEmpty(entry.key, `${path}.pickups[${index}].key`),
      rewardType: requireNonEmpty(entry.rewardType, `${path}.pickups[${index}].rewardType`),
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

function normalizeRequirement(
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

function normalizeWeapons(
  raw: RawTraitCatalogInput['weapons'],
): CatalogCollection<WeaponDeclaration> {
  const declarations = requireArray(raw, 'weapons').map(
    (value, index) => requireObject(value, `weapons[${index}]`) as unknown as RawWeaponDeclaration,
  );
  const values = declarations.map((weapon, index) => {
    const path = `weapons[${index}]`;
    const aspectKeys = freezeUniqueStrings(
      requireArray(weapon.aspectKeys, `${path}.aspectKeys`) as readonly string[],
      `${path}.aspectKeys`,
    );
    if (aspectKeys.length !== 4) fail(`${path}.aspectKeys`, 'must declare four aspects');
    const defaultAspectKey = requireNonEmpty(weapon.defaultAspectKey, `${path}.defaultAspectKey`);
    if (!aspectKeys.includes(defaultAspectKey))
      fail(`${path}.defaultAspectKey`, 'must belong to aspectKeys');
    return Object.freeze({
      key: requireNonEmpty(weapon.key, `${path}.key`),
      label: requireNonEmpty(weapon.label, `${path}.label`),
      aspectKeys,
      defaultAspectKey,
    });
  });
  return createCollection(values, 'weapons', (weapon) => weapon.key);
}

function normalizeAspects(
  raw: RawTraitCatalogInput['aspects'],
  weapons: CatalogCollection<WeaponDeclaration>,
): CatalogCollection<AspectDeclaration> {
  const declarations = requireArray(raw, 'aspects').map(
    (value, index) => requireObject(value, `aspects[${index}]`) as unknown as RawAspectDeclaration,
  );
  const values = declarations.map((aspect, index) => {
    const path = `aspects[${index}]`;
    const weaponKey = requireNonEmpty(aspect.weaponKey, `${path}.weaponKey`);
    if (weapons.byKey[weaponKey] === undefined)
      fail(`${path}.weaponKey`, `unknown weapon ${weaponKey}`);
    const startingTrait =
      aspect.startingTrait === undefined
        ? undefined
        : normalizeAspectStartingTrait(aspect.startingTrait, `${path}.startingTrait`);
    return Object.freeze({
      key: requireNonEmpty(aspect.key, `${path}.key`),
      label: requireNonEmpty(aspect.label, `${path}.label`),
      weaponKey,
      ...(startingTrait === undefined ? {} : { startingTrait }),
    });
  });
  const collection = createCollection(values, 'aspects', (aspect) => aspect.key);
  for (const weapon of weapons.values) {
    for (const aspectKey of weapon.aspectKeys) {
      const aspect = collection.byKey[aspectKey];
      if (aspect === undefined)
        fail(`weapons.${weapon.key}.aspectKeys`, `unknown aspect ${aspectKey}`);
      if (aspect.weaponKey !== weapon.key)
        fail(`weapons.${weapon.key}.aspectKeys`, `cross-weapon aspect ${aspectKey}`);
    }
  }
  const referencedAspectKeys = new Set(weapons.values.flatMap((weapon) => weapon.aspectKeys));
  for (const aspect of collection.values) {
    if (!referencedAspectKeys.has(aspect.key))
      fail(`aspects.${aspect.key}`, 'is not declared by a weapon');
  }
  return collection;
}

function normalizeAspectStartingTrait(
  raw: unknown,
  path: string,
): NonNullable<AspectDeclaration['startingTrait']> {
  const value = requireObject(raw, path);
  const keys = Object.keys(value);
  if (keys.length !== 2 || !Object.hasOwn(value, 'traitKey') || !Object.hasOwn(value, 'giverKey')) {
    fail(path, 'must contain exactly traitKey and giverKey');
  }
  return Object.freeze({
    traitKey: requireNonEmpty(value.traitKey as string, `${path}.traitKey`),
    giverKey: requireNonEmpty(value.giverKey as string, `${path}.giverKey`),
  });
}

function normalizeTraits(
  raw: RawTraitCatalogInput['traits'],
  weapons: CatalogCollection<WeaponDeclaration>,
  aspects: CatalogCollection<AspectDeclaration>,
  deferred: ReadonlySet<string>,
  coreGodTraitKeys: ReadonlySet<string>,
): CatalogCollection<TraitDeclaration> {
  const declarations = requireArray(raw, 'traits').map(
    (value, index) => requireObject(value, `traits[${index}]`) as unknown as RawTraitDeclaration,
  );
  const declaredKeys = new Set(declarations.map((trait) => trait.key));
  const declarationContact = {
    values: [],
    byKey: Object.fromEntries([...declaredKeys].map((key) => [key, {} as TraitDeclaration])),
  } as CatalogCollection<TraitDeclaration>;
  const values = declarations.map((trait, index) => {
    const path = `traits[${index}]`;
    const isHammer = trait.hammerCompatibility !== undefined;
    const declaresNoRarity =
      trait.rarityDomain === undefined
        ? false
        : closedValue(trait.rarityDomain, ['none'] as const, `${path}.rarityDomain`) === 'none';
    const isRarityless = isHammer || declaresNoRarity;
    const usesBoonRarity = requireBoolean(trait.usesBoonRarity, `${path}.usesBoonRarity`);
    const isCoreGodTrait = coreGodTraitKeys.has(trait.key);
    if (isCoreGodTrait && !usesBoonRarity) {
      fail(`${path}.usesBoonRarity`, 'core god traits must use boon rarity');
    }
    if (
      declaresNoRarity &&
      (trait.freshOfferRarities !== undefined || trait.equippedRarities !== undefined)
    ) {
      fail(`${path}.freshOfferRarities`, 'explicitly rarityless traits must omit rarity arrays');
    }
    const freshOfferRarities = freezeUniqueStrings(
      (trait.freshOfferRarities === undefined
        ? []
        : requireArray(
            trait.freshOfferRarities,
            `${path}.freshOfferRarities`,
          )) as readonly string[],
      `${path}.freshOfferRarities`,
    ) as TraitRarity[];
    const equippedRarities = freezeUniqueStrings(
      (trait.equippedRarities === undefined
        ? []
        : requireArray(trait.equippedRarities, `${path}.equippedRarities`)) as readonly string[],
      `${path}.equippedRarities`,
    ) as TraitRarity[];
    if (isRarityless && usesBoonRarity) {
      fail(`${path}.usesBoonRarity`, 'rarityless traits cannot use boon rarity');
    }
    if (!isRarityless && (freshOfferRarities.length === 0 || equippedRarities.length === 0)) {
      fail(`${path}.freshOfferRarities`, 'ranked rarity domains must not be empty');
    }
    freshOfferRarities.forEach((rarity, rarityIndex) =>
      closedValue(rarity, FRESH_RARITIES, `${path}.freshOfferRarities[${rarityIndex}]`),
    );
    equippedRarities.forEach((rarity, rarityIndex) =>
      closedValue(rarity, RARITIES, `${path}.equippedRarities[${rarityIndex}]`),
    );
    for (const rarity of freshOfferRarities)
      if (!equippedRarities.includes(rarity))
        fail(`${path}.freshOfferRarities`, `${rarity} is absent from equippedRarities`);
    const elementContributions: Partial<Record<TraitElement, number>> = {};
    const elementContributionRecord = requireObject(
      trait.elementContributions,
      `${path}.elementContributions`,
    );
    for (const [element, count] of Object.entries(elementContributionRecord)) {
      const normalizedElement = closedValue(
        element,
        ELEMENTS,
        `${path}.elementContributions.${element}`,
      );
      if (typeof count !== 'number' || !Number.isInteger(count) || count <= 0)
        fail(`${path}.elementContributions.${element}`, 'must be a positive integer');
      elementContributions[normalizedElement] = count;
    }
    let hammerCompatibility: HammerCompatibility | undefined;
    if (trait.hammerCompatibility !== undefined) {
      const hammerDeclaration = requireObject(
        trait.hammerCompatibility,
        `${path}.hammerCompatibility`,
      ) as unknown as NonNullable<RawTraitDeclaration['hammerCompatibility']> & {
        readonly supportsRankII?: unknown;
      };
      const weaponKey = requireNonEmpty(
        hammerDeclaration.weaponKey,
        `${path}.hammerCompatibility.weaponKey`,
      );
      const weapon = weapons.byKey[weaponKey];
      if (weapon === undefined)
        fail(`${path}.hammerCompatibility.weaponKey`, `unknown weapon ${weaponKey}`);
      const aspectKeys = freezeUniqueStrings(
        requireArray(
          hammerDeclaration.aspectKeys,
          `${path}.hammerCompatibility.aspectKeys`,
        ) as readonly string[],
        `${path}.hammerCompatibility.aspectKeys`,
      );
      if (aspectKeys.length === 0)
        fail(`${path}.hammerCompatibility.aspectKeys`, 'must not be empty');
      for (const aspectKey of aspectKeys) {
        const aspect = aspects.byKey[aspectKey];
        if (aspect === undefined)
          fail(`${path}.hammerCompatibility.aspectKeys`, `unknown aspect ${aspectKey}`);
        if (aspect.weaponKey !== weaponKey)
          fail(`${path}.hammerCompatibility.aspectKeys`, `cross-weapon aspect ${aspectKey}`);
      }
      hammerCompatibility = Object.freeze({
        weaponKey,
        aspectKeys,
        supportsRankII: requireBoolean(
          hammerDeclaration.supportsRankII,
          `${path}.hammerCompatibility.supportsRankII`,
        ),
      });
    }
    const offerRequirements = Object.freeze(
      (
        requireArray(
          trait.offerRequirements,
          `${path}.offerRequirements`,
        ) as readonly TraitRequirementExpression[]
      ).map((requirement, requirementIndex) =>
        normalizeRequirement(
          requirement,
          declarationContact,
          deferred,
          `${path}.offerRequirements[${requirementIndex}]`,
        ),
      ),
    );
    let rarityFloorEffect: ProperUpbringingEffect | undefined;
    if (trait.rarityFloorEffect !== undefined) {
      const effectPath = `${path}.rarityFloorEffect`;
      if (trait.key !== 'ElementalRarityUpgradeBoon')
        fail(effectPath, 'is reserved to ElementalRarityUpgradeBoon');
      if (isRarityless) fail(effectPath, 'rarityless traits cannot declare a rarity floor effect');
      const effect = requireObject(trait.rarityFloorEffect, effectPath) as unknown as {
        readonly activationElementMinimums?: unknown;
        readonly fromRarity?: unknown;
        readonly minimumRarity?: unknown;
        readonly boonRarityContribution?: unknown;
      };
      const effectKeys = [
        'activationElementMinimums',
        'fromRarity',
        'minimumRarity',
        'boonRarityContribution',
      ];
      if (
        Object.keys(effect).length !== effectKeys.length ||
        effectKeys.some((key) => !(key in effect))
      )
        fail(effectPath, 'must contain exactly the Proper Upbringing effect fields');
      const rawMinimums = requireObject(
        effect.activationElementMinimums,
        `${effectPath}.activationElementMinimums`,
      );
      const minimums: Partial<Record<TraitElement, number>> = {};
      for (const [element, minimum] of Object.entries(rawMinimums)) {
        const normalizedElement = closedValue(
          element,
          ELEMENTS,
          `${effectPath}.activationElementMinimums.${element}`,
        );
        minimums[normalizedElement] = requirePositiveInteger(
          minimum as number,
          `${effectPath}.activationElementMinimums.${element}`,
        );
      }
      if (Object.keys(minimums).length === 0)
        fail(`${effectPath}.activationElementMinimums`, 'must not be empty');
      const fromRarity = closedValue(
        effect.fromRarity,
        IN_RUN_RARITIES,
        `${effectPath}.fromRarity`,
      );
      const minimumRarity = closedValue(
        effect.minimumRarity,
        IN_RUN_RARITIES,
        `${effectPath}.minimumRarity`,
      );
      if (fromRarity !== 'Common')
        fail(`${effectPath}.fromRarity`, 'must be Common for a scalable god-trait floor');
      if (minimumRarity !== 'Rare')
        fail(`${effectPath}.minimumRarity`, 'must be Rare for a scalable god-trait floor');
      if (IN_RUN_RARITIES.indexOf(minimumRarity) <= IN_RUN_RARITIES.indexOf(fromRarity))
        fail(`${effectPath}.minimumRarity`, 'must follow fromRarity in the in-run rarity order');
      const rawContribution = requireObject(
        effect.boonRarityContribution,
        `${effectPath}.boonRarityContribution`,
      );
      if (Object.keys(rawContribution).length !== 1 || rawContribution.additive === undefined)
        fail(`${effectPath}.boonRarityContribution`, 'must contain exactly additive');
      const rawAdditive = requireObject(
        rawContribution.additive,
        `${effectPath}.boonRarityContribution.additive`,
      );
      if (Object.keys(rawAdditive).length !== 1 || rawAdditive.Rare !== 1)
        fail(`${effectPath}.boonRarityContribution.additive`, 'must contain exactly Rare: 1');
      rarityFloorEffect = Object.freeze({
        activationElementMinimums: Object.freeze(minimums),
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        boonRarityContribution: Object.freeze({ additive: Object.freeze({ Rare: 1 }) }),
      });
    }
    let targetedAcquisition: TargetedTraitAcquisition | undefined;
    if (trait.targetedAcquisition !== undefined) {
      const acquisitionPath = `${path}.targetedAcquisition`;
      if (isHammer)
        fail(acquisitionPath, 'Hammer traits cannot target another trait on acquisition');
      const acquisition = requireObject(trait.targetedAcquisition, acquisitionPath) as unknown as {
        readonly kind?: unknown;
        readonly target?: unknown;
        readonly maximumEligibleLevelByTraitAndRarity?: unknown;
      };
      const kind = closedValue(
        acquisition.kind,
        ['promoteGodTraitToHeroic', 'upgradeHammerToRank2'] as const,
        `${acquisitionPath}.kind`,
      );
      const target =
        kind === 'promoteGodTraitToHeroic'
          ? closedValue(
              acquisition.target,
              ['superchargeableGodTrait'] as const,
              `${acquisitionPath}.target`,
            )
          : closedValue(
              acquisition.target,
              ['upgradableHammer'] as const,
              `${acquisitionPath}.target`,
            );
      if (kind === 'promoteGodTraitToHeroic') {
        const rawLimits = acquisition.maximumEligibleLevelByTraitAndRarity;
        let maximumEligibleLevelByTraitAndRarity:
          Readonly<Record<string, Readonly<Partial<Record<TraitRarity, number>>>>> | undefined;
        if (rawLimits !== undefined) {
          const limits = requireObject(
            rawLimits,
            `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity`,
          );
          const normalized: Record<string, Readonly<Partial<Record<TraitRarity, number>>>> = {};
          for (const [targetTraitKey, rawByRarity] of Object.entries(limits)) {
            const targetTrait = declarations.find((candidate) => candidate.key === targetTraitKey);
            if (targetTrait === undefined)
              fail(
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}`,
                'unknown trait',
              );
            if (!coreGodTraitKeys.has(targetTraitKey) || targetTrait.blockStacking) {
              fail(
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}`,
                'must be a Pom-eligible core god trait',
              );
            }
            const byRarity = requireObject(
              rawByRarity,
              `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}`,
            );
            const normalizedByRarity: Partial<Record<TraitRarity, number>> = {};
            for (const [rarity, maximum] of Object.entries(byRarity)) {
              const normalizedRarity = closedValue(
                rarity,
                IN_RUN_RARITIES,
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}.${rarity}`,
              );
              if (!targetTrait.equippedRarities?.includes(normalizedRarity)) {
                fail(
                  `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}.${rarity}`,
                  'must be an equipped rarity of the target trait',
                );
              }
              normalizedByRarity[normalizedRarity] = requirePositiveInteger(
                maximum as number,
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}.${rarity}`,
              );
            }
            if (Object.keys(normalizedByRarity).length === 0)
              fail(
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}`,
                'must not be empty',
              );
            const freshRarities = targetTrait.freshOfferRarities ?? [];
            if (
              Object.keys(normalizedByRarity).length !== freshRarities.length ||
              freshRarities.some((rarity) => normalizedByRarity[rarity] === undefined)
            ) {
              fail(
                `${acquisitionPath}.maximumEligibleLevelByTraitAndRarity.${targetTraitKey}`,
                'must cover exactly the target fresh ranked rarities',
              );
            }
            normalized[targetTraitKey] = Object.freeze(normalizedByRarity);
          }
          if (Object.keys(normalized).length === 0)
            fail(`${acquisitionPath}.maximumEligibleLevelByTraitAndRarity`, 'must not be empty');
          maximumEligibleLevelByTraitAndRarity = Object.freeze(normalized);
        }
        targetedAcquisition = Object.freeze({
          kind,
          target: target as 'superchargeableGodTrait',
          ...(maximumEligibleLevelByTraitAndRarity === undefined
            ? {}
            : { maximumEligibleLevelByTraitAndRarity }),
        });
      } else {
        targetedAcquisition = Object.freeze({ kind, target: target as 'upgradableHammer' });
      }
    }
    // Requirement operands are checked against the complete trait collection after it exists.
    const rarityDomain = Object.freeze(
      isRarityless
        ? ({ kind: 'none' } as const)
        : ({
            kind: 'ranked' as const,
            freshOfferRarities: Object.freeze(freshOfferRarities),
            equippedRarities: Object.freeze(equippedRarities),
          } as const),
    );
    if (isRarityless && (freshOfferRarities.length !== 0 || equippedRarities.length !== 0)) {
      fail(`${path}.freshOfferRarities`, 'rarityless traits cannot declare rarity arrays');
    }
    const selectedDisposition = normalizeSelectedDisposition(
      trait.selectedDisposition,
      `${path}.selectedDisposition`,
    );
    if (
      trait.key === 'KeepsakeLevelBoon' &&
      selectedDisposition.kind !== 'advanceCurrentKeepsake'
    ) {
      fail(
        `${path}.selectedDisposition`,
        'KeepsakeLevelBoon must declare the rank-one current-keepsake advance',
      );
    }
    if (
      trait.key !== 'KeepsakeLevelBoon' &&
      selectedDisposition.kind === 'advanceCurrentKeepsake'
    ) {
      fail(`${path}.selectedDisposition`, 'is reserved for KeepsakeLevelBoon');
    }
    return Object.freeze({
      key: requireNonEmpty(trait.key, `${path}.key`),
      label: requireNonEmpty(trait.label, `${path}.label`),
      rarityDomain,
      offerRequirements,
      ...(trait.equipmentSlot === undefined
        ? {}
        : {
            equipmentSlot: closedValue(
              trait.equipmentSlot,
              EQUIPMENT_SLOTS,
              `${path}.equipmentSlot`,
            ),
          }),
      elementContributions: Object.freeze(elementContributions),
      usesBoonRarity,
      isCoreGodTrait,
      blockStacking: requireBoolean(trait.blockStacking, `${path}.blockStacking`),
      blockInRunRarify: requireBoolean(trait.blockInRunRarify, `${path}.blockInRunRarify`),
      excludeFromRarityCount: requireBoolean(
        trait.excludeFromRarityCount,
        `${path}.excludeFromRarityCount`,
      ),
      ...(rarityFloorEffect === undefined ? {} : { rarityFloorEffect }),
      ...(targetedAcquisition === undefined ? {} : { targetedAcquisition }),
      ...(trait.selfExclusion === undefined
        ? {}
        : { selfExclusion: requireNonEmpty(trait.selfExclusion, `${path}.selfExclusion`) }),
      ...(hammerCompatibility === undefined ? {} : { hammerCompatibility }),
      selectedDisposition,
    });
  });
  const collection = createCollection(values, 'traits', (trait) => trait.key);
  // Re-run requirements now that exact included keys are known.
  for (const trait of collection.values) {
    trait.offerRequirements.forEach((requirement, index) =>
      normalizeRequirement(
        requirement,
        collection,
        deferred,
        `traits.${trait.key}.offerRequirements[${index}]`,
      ),
    );
  }
  return collection;
}

function collectCoreGodTraitKeys(raw: RawTraitCatalogInput['givers']): ReadonlySet<string> {
  const keys = new Set<string>();
  requireArray(raw, 'givers').forEach((value, index) => {
    const path = `givers[${index}]`;
    const giver = requireObject(value, path) as unknown as RawTraitGiverDeclaration;
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer', 'npc', 'spell'] as const,
      `${path}.providerKind`,
    );
    if (providerKind !== 'olympian') return;
    (requireArray(giver.traitKeys, `${path}.traitKeys`) as readonly string[]).forEach(
      (traitKey, traitIndex) => {
        keys.add(requireNonEmpty(traitKey, `${path}.traitKeys[${traitIndex}]`));
      },
    );
  });
  return keys;
}

function normalizeGivers(
  raw: RawTraitCatalogInput['givers'],
  traits: CatalogCollection<TraitDeclaration>,
): CatalogCollection<TraitGiverDeclaration> {
  const declarations = requireArray(raw, 'givers').map(
    (value, index) =>
      requireObject(value, `givers[${index}]`) as unknown as RawTraitGiverDeclaration,
  );
  const values = declarations.map((giver, index) => {
    const path = `givers[${index}]`;
    const allowedKeys = new Set([
      'key',
      'label',
      'providerKind',
      'traitKeys',
      'priorityTraitKeys',
      'rarityPolicy',
      'denialParticipates',
    ]);
    const unsupportedKey = Object.keys(giver).find((key) => !allowedKeys.has(key));
    if (unsupportedKey !== undefined) fail(`${path}.${unsupportedKey}`, 'is not supported');
    if (giver.denialParticipates !== undefined)
      requireBoolean(giver.denialParticipates, `${path}.denialParticipates`);
    const priorityTraitKeys = freezeUniqueStrings(
      requireArray(giver.priorityTraitKeys, `${path}.priorityTraitKeys`) as readonly string[],
      `${path}.priorityTraitKeys`,
    );
    const traitKeys = freezeUniqueStrings(
      requireArray(giver.traitKeys, `${path}.traitKeys`) as readonly string[],
      `${path}.traitKeys`,
    );
    if (traitKeys.length === 0) fail(`${path}.traitKeys`, 'must not be empty');
    for (const [memberIndex, traitKey] of traitKeys.entries()) {
      const trait = traits.byKey[traitKey];
      if (trait === undefined)
        fail(`${path}.traitKeys[${memberIndex}]`, `unknown trait ${traitKey}`);
      if (giver.providerKind === 'hammer' && trait.hammerCompatibility === undefined)
        fail(
          `${path}.traitKeys[${memberIndex}]`,
          'Hammer giver members require Hammer compatibility',
        );
      if (giver.providerKind === 'hammer' && trait.rarityDomain.kind !== 'none')
        fail(`${path}.traitKeys[${memberIndex}]`, 'Hammer members must have no rarity domain');
      if (giver.providerKind !== 'hammer' && trait.hammerCompatibility !== undefined)
        fail(`${path}.traitKeys[${memberIndex}]`, 'non-Hammer giver cannot contain a Hammer trait');
    }
    for (const [priorityIndex, traitKey] of priorityTraitKeys.entries()) {
      if (!traitKeys.includes(traitKey))
        fail(`${path}.priorityTraitKeys[${priorityIndex}]`, 'must belong to giver pool');
      if (traits.byKey[traitKey] === undefined)
        fail(`${path}.priorityTraitKeys[${priorityIndex}]`, `unknown trait ${traitKey}`);
    }
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer', 'npc', 'spell'] as const,
      `${path}.providerKind`,
    );
    const rarityPolicy = requireObject(
      giver.rarityPolicy,
      `${path}.rarityPolicy`,
    ) as unknown as RawTraitGiverDeclaration['rarityPolicy'];
    const rarityPolicyDeclaration = rarityPolicy as unknown as {
      readonly kind?: unknown;
      readonly rarity?: unknown;
      readonly rarities?: unknown;
    };
    const rarityPolicyKind = closedValue(
      rarityPolicyDeclaration.kind,
      ['none', 'fixed', 'selectable'] as const,
      `${path}.rarityPolicy.kind`,
    );
    const expectedRarityPolicyKeys =
      rarityPolicyKind === 'none'
        ? ['kind']
        : rarityPolicyKind === 'fixed'
          ? ['kind', 'rarity']
          : ['kind', 'rarities'];
    const sortedExpectedRarityPolicyKeys = [...expectedRarityPolicyKeys].sort();
    const actualRarityPolicyKeys = Object.keys(rarityPolicy).sort();
    if (
      actualRarityPolicyKeys.length !== sortedExpectedRarityPolicyKeys.length ||
      actualRarityPolicyKeys.some((key, index) => key !== sortedExpectedRarityPolicyKeys[index])
    ) {
      fail(
        `${path}.rarityPolicy`,
        `${rarityPolicyKind} rarity policy must contain exactly ${expectedRarityPolicyKeys.join(', ')}`,
      );
    }
    const normalizedRarityPolicy =
      rarityPolicyKind === 'none'
        ? ({ kind: 'none' } as const)
        : rarityPolicyKind === 'fixed'
          ? ({
              kind: 'fixed' as const,
              rarity: closedValue(
                rarityPolicyDeclaration.rarity,
                ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const,
                `${path}.rarityPolicy.rarity`,
              ),
            } as const)
          : rarityPolicyKind === 'selectable'
            ? (() => {
                const rarities = freezeUniqueStrings(
                  requireArray(
                    rarityPolicyDeclaration.rarities,
                    `${path}.rarityPolicy.rarities`,
                  ) as readonly string[],
                  `${path}.rarityPolicy.rarities`,
                ).map((rarity, rarityIndex) =>
                  closedValue(
                    rarity,
                    ['Common', 'Rare', 'Epic'] as const,
                    `${path}.rarityPolicy.rarities[${rarityIndex}]`,
                  ),
                );
                if (rarities.length === 0) {
                  fail(`${path}.rarityPolicy.rarities`, 'must not be empty');
                }
                return { kind: 'selectable' as const, rarities: Object.freeze(rarities) };
              })()
            : (rarityPolicyKind satisfies never);
    const frozenRarityPolicy = Object.freeze(normalizedRarityPolicy);
    if (providerKind === 'hammer' && frozenRarityPolicy.kind !== 'none')
      fail(`${path}.rarityPolicy`, 'Hammer givers require no rarity authorship');
    const memberRarityKinds = traitKeys.map(
      (traitKey) => traits.byKey[traitKey]!.rarityDomain.kind,
    );
    if (frozenRarityPolicy.kind === 'none' && memberRarityKinds.some((kind) => kind !== 'none'))
      fail(`${path}.rarityPolicy`, 'no-rarity givers require only rarityless members');
    if (frozenRarityPolicy.kind !== 'none' && memberRarityKinds.some((kind) => kind === 'none'))
      fail(`${path}.rarityPolicy`, 'ranked giver policies cannot contain rarityless members');
    if (providerKind === 'olympian') {
      if (priorityTraitKeys.length !== 5)
        fail(`${path}.priorityTraitKeys`, 'Olympian givers require exactly five priority traits');
      const prioritySlots = priorityTraitKeys.map(
        (traitKey) => traits.byKey[traitKey]?.equipmentSlot,
      );
      if (
        prioritySlots.some((slot) => slot === undefined) ||
        new Set(prioritySlots).size !== 5 ||
        !(['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const).every((slot) =>
          prioritySlots.includes(slot),
        )
      ) {
        fail(
          `${path}.priorityTraitKeys`,
          'Olympian priority traits must cover Melee, Secondary, Ranged, Rush, and Mana',
        );
      }
    } else if (priorityTraitKeys.length !== 0) {
      fail(`${path}.priorityTraitKeys`, 'non-Olympian givers must not declare priority traits');
    }
    return Object.freeze({
      key: requireNonEmpty(giver.key, `${path}.key`),
      label: requireNonEmpty(giver.label, `${path}.label`),
      providerKind,
      callingCardMenu: CALLING_CARD_GIVERS.has(requireNonEmpty(giver.key, `${path}.key`)),
      traitKeys,
      priorityTraitKeys,
      rarityPolicy: frozenRarityPolicy,
      ...(giver.denialParticipates === true ? { denialParticipates: true } : {}),
    });
  });
  const denialKeys = values.filter((giver) => giver.denialParticipates).map((giver) => giver.key);
  const expectedDenialKeys = [
    'Aphrodite',
    'Apollo',
    'Ares',
    'Demeter',
    'Hephaestus',
    'Hera',
    'Hestia',
    'Poseidon',
    'Zeus',
    'Hermes',
  ];
  const expectedDenialKeySet = new Set(expectedDenialKeys);
  const actualDenialKeySet = new Set(denialKeys);
  const missingDenialKeys = expectedDenialKeys.filter((key) => !actualDenialKeySet.has(key));
  const unexpectedDenialKeys = denialKeys.filter((key) => !expectedDenialKeySet.has(key));
  if (
    denialKeys.length !== expectedDenialKeys.length ||
    missingDenialKeys.length > 0 ||
    unexpectedDenialKeys.length > 0
  )
    fail(
      'givers',
      `Denial participants must be exactly the nine Olympians and Hermes (missing: ${missingDenialKeys.join(',') || 'none'}; unexpected: ${unexpectedDenialKeys.join(',') || 'none'})`,
    );
  for (const giver of values) {
    if (
      giver.denialParticipates &&
      giver.providerKind !== 'olympian' &&
      giver.providerKind !== 'hermes'
    )
      fail(`givers.${giver.key}.denialParticipates`, 'requires an Olympian or Hermes giver');
  }
  return createCollection(values, 'givers', (giver) => giver.key);
}

function validateDirectTraitSets(
  traits: CatalogCollection<TraitDeclaration>,
  givers: CatalogCollection<TraitGiverDeclaration>,
): void {
  const expected = [
    ['earth', 'ElementalDamageBoon', 'ElementalOlympianDamageBoon'],
    ['fire', 'ElementalBaseDamageBoon', 'ElementalRallyBoon'],
    ['air', 'ElementalDamageFloorBoon', 'ElementalDodgeBoon'],
    ['water', 'ElementalHealthBoon', 'ElementalDamageCapBoon'],
  ] as const;
  for (const trait of traits.values) {
    if (trait.key === 'AllElementalBoon') {
      if (trait.selectedDisposition.kind !== 'directTraitSets')
        fail(`traits.${trait.key}.selectedDisposition`, 'must declare the fixed direct trait sets');
      const sets = trait.selectedDisposition.sets;
      if (
        sets.length !== expected.length ||
        expected.some(
          ([key, first, second], index) =>
            sets[index]?.key !== key ||
            sets[index]?.traitKeys[0] !== first ||
            sets[index]?.traitKeys[1] !== second,
        )
      )
        fail(`traits.${trait.key}.selectedDisposition.sets`, 'must match the source pair matrix');
      for (const set of sets) {
        for (const member of set.traitKeys) {
          const declaration = traits.byKey[member];
          if (declaration === undefined)
            fail(
              `traits.${trait.key}.selectedDisposition.sets.${set.key}`,
              `unknown trait ${member}`,
            );
          const providers = givers.values.filter((giver) => giver.traitKeys.includes(member));
          if (providers.length !== 1)
            fail(
              `traits.${trait.key}.selectedDisposition.sets.${set.key}`,
              `${member} must belong to exactly one giver`,
            );
        }
      }
    } else if (trait.selectedDisposition.kind === 'directTraitSets') {
      fail(
        `traits.${trait.key}.selectedDisposition`,
        'direct trait sets are reserved for All Together',
      );
    }
  }
}

function validateTravelDeal(traits: CatalogCollection<TraitDeclaration>): void {
  const expected = { Common: 0.05, Rare: 0.1, Epic: 0.15, Heroic: 0.2 } as const;
  for (const trait of traits.values) {
    if (trait.key === 'RestockBoon') {
      const disposition = trait.selectedDisposition;
      if (
        disposition.kind !== 'worldShopRestock' ||
        disposition.refillCount !== 1 ||
        Object.entries(expected).some(
          ([rarity, value]) =>
            disposition.kind !== 'worldShopRestock' ||
            disposition.discountByRarity[rarity as keyof typeof expected] !== value,
        )
      )
        fail('traits.RestockBoon.selectedDisposition', 'must match Travel Deal source values');
    } else if (trait.selectedDisposition.kind === 'worldShopRestock') {
      fail(
        `traits.${trait.key}.selectedDisposition`,
        'worldShopRestock is reserved for RestockBoon',
      );
    }
  }
}

function normalizeContexts(
  raw: RawTraitCatalogInput['offerContexts'],
): CatalogCollection<TraitOfferContextDeclaration> {
  const declarations = requireArray(raw, 'offerContexts').map(
    (value, index) =>
      requireObject(
        value,
        `offerContexts[${index}]`,
      ) as unknown as RawTraitCatalogInput['offerContexts'][number],
  );
  const values = declarations.map((context, index) => {
    const path = `offerContexts[${index}]`;
    const key = closedValue(context.key, CONTEXTS, `${path}.key`);
    if (
      key === 'devotionNoDuo' &&
      (context.kind !== 'rewardRarityBlock' || context.blockedRarity !== 'Duo')
    )
      fail(path, 'must block Duo rarity');
    if (
      key === 'blockGiftBoons' &&
      (context.kind !== 'roomFlag' || context.roomFlag !== 'BlockGiftBoons')
    )
      fail(path, 'must reference BlockGiftBoons');
    if (
      key === 'deathDefianceConditionMet' &&
      (context.kind !== 'authoredCondition' ||
        context.authoredCondition !== 'deathDefianceConditionMet')
    )
      fail(path, 'must be an authored condition context');
    if (
      key === 'circeRemovableFearVow' &&
      (context.kind !== 'authoredCondition' ||
        context.authoredCondition !== 'circeRemovableFearVow')
    )
      fail(path, 'must be the Circe removable-Fear context');
    return Object.freeze({
      key,
      kind: context.kind,
      ...(context.blockedRarity === undefined
        ? {}
        : { blockedRarity: closedValue(context.blockedRarity, RARITIES, `${path}.blockedRarity`) }),
      ...(context.roomFlag === undefined ? {} : { roomFlag: context.roomFlag }),
      ...(context.authoredCondition === undefined
        ? {}
        : { authoredCondition: context.authoredCondition }),
    });
  });
  const collection = createCollection(values, 'offerContexts', (context) => context.key);
  for (const key of CONTEXTS)
    if (collection.byKey[key] === undefined) fail('offerContexts', `missing ${key}`);
  return collection;
}

function normalizeEchoLastRunBoon(
  raw: RawTraitCatalogInput['echoLastRunBoon'],
  traits: CatalogCollection<TraitDeclaration>,
  givers: CatalogCollection<TraitGiverDeclaration>,
): EchoLastRunBoonCatalog {
  const value = requireObject(
    raw,
    'echoLastRunBoon',
  ) as unknown as RawTraitCatalogInput['echoLastRunBoon'];
  const actualKeys = Object.keys(value).sort();
  if (
    actualKeys.length !== 2 ||
    actualKeys[0] !== 'excludedTraitKeys' ||
    actualKeys[1] !== 'sources'
  )
    fail('echoLastRunBoon', 'must contain exactly excludedTraitKeys and sources');
  const excludedTraitKeys = freezeUniqueStrings(
    requireArray(value.excludedTraitKeys, 'echoLastRunBoon.excludedTraitKeys') as readonly string[],
    'echoLastRunBoon.excludedTraitKeys',
  );
  for (const [index, traitKey] of excludedTraitKeys.entries()) {
    if (traits.byKey[traitKey] === undefined)
      fail(`echoLastRunBoon.excludedTraitKeys[${index}]`, `unknown trait ${traitKey}`);
  }
  const sources = requireArray(value.sources, 'echoLastRunBoon.sources').map((entry, index) => {
    const path = `echoLastRunBoon.sources[${index}]`;
    const source = requireObject(entry, path) as {
      readonly giverKey?: unknown;
      readonly lootHistorySource?: unknown;
    };
    const expectedKeys =
      source.lootHistorySource === undefined ? ['giverKey'] : ['giverKey', 'lootHistorySource'];
    const keys = Object.keys(source).sort();
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key, keyIndex) => key !== [...expectedKeys].sort()[keyIndex])
    )
      fail(path, `must contain exactly ${expectedKeys.join(' and ')}`);
    if (typeof source.giverKey !== 'string') fail(`${path}.giverKey`, 'must be a string');
    const giverKey = requireNonEmpty(source.giverKey, `${path}.giverKey`);
    const giver = givers.byKey[giverKey];
    if (giver === undefined) fail(`${path}.giverKey`, `unknown giver ${giverKey}`);
    if (giver.providerKind === 'hammer' || giver.rarityPolicy.kind === 'none')
      fail(`${path}.giverKey`, `${giverKey} cannot participate in Echo's last-run domain`);
    return Object.freeze({
      giver,
      ...(source.lootHistorySource === undefined
        ? {}
        : typeof source.lootHistorySource !== 'string'
          ? fail(`${path}.lootHistorySource`, 'must be a string')
          : {
              lootHistorySource: requireNonEmpty(
                source.lootHistorySource,
                `${path}.lootHistorySource`,
              ),
            }),
    });
  });
  if (
    sources.length === 0 ||
    new Set(sources.map((source) => source.giver.key)).size !== sources.length
  )
    fail('echoLastRunBoon.sources', 'must contain distinct participating givers');
  const participantTraitKeys = new Set(sources.flatMap((source) => [...source.giver.traitKeys]));
  for (const traitKey of excludedTraitKeys) {
    if (!participantTraitKeys.has(traitKey))
      fail('echoLastRunBoon.excludedTraitKeys', `${traitKey} is not in a participating giver`);
  }
  const variants = sources.flatMap(({ giver, lootHistorySource }) =>
    giver.traitKeys.flatMap((traitKey) => {
      if (excludedTraitKeys.includes(traitKey)) return [];
      const trait = traits.byKey[traitKey];
      if (trait?.rarityDomain.kind !== 'ranked')
        fail(
          'echoLastRunBoon.sources',
          `${giver.key}.${traitKey} must have a ranked rarity domain`,
        );
      return [
        Object.freeze({
          key: `${giver.key}:${traitKey}`,
          giverKey: giver.key,
          traitKey,
          ...(trait.offerRequirements.some(
            (requirement) =>
              requirement.kind === 'offerContext' &&
              requirement.context === 'deathDefianceConditionMet' &&
              requirement.required,
          )
            ? { requiresDeathDefianceCondition: true }
            : {}),
          ...(lootHistorySource === undefined ? {} : { lootHistorySource }),
        }),
      ];
    }),
  );
  return Object.freeze({
    variants: createCollection(variants, 'echoLastRunBoon.variants', (variant) => variant.key),
  });
}

export function createTraitCatalog(input: RawTraitCatalogInput): TraitCatalog {
  const declaredDeferred = freezeUniqueStrings(
    requireArray(input.deferredTraitKeys, 'deferredTraitKeys') as readonly string[],
    'deferredTraitKeys',
  );
  const deferred = new Set(declaredDeferred);
  const weapons = normalizeWeapons(input.weapons);
  const aspects = normalizeAspects(input.aspects, weapons);
  const coreGodTraitKeys = collectCoreGodTraitKeys(input.givers);
  const traits = normalizeTraits(input.traits, weapons, aspects, deferred, coreGodTraitKeys);
  if (traits.byKey.ElementalRarityUpgradeBoon?.rarityFloorEffect === undefined)
    fail(
      'traits.ElementalRarityUpgradeBoon.rarityFloorEffect',
      'must declare the Proper Upbringing effect',
    );
  for (const key of declaredDeferred) {
    if (traits.byKey[key] !== undefined) {
      fail('deferredTraitKeys', `${key} is also an included trait`);
    }
  }
  const givers = normalizeGivers(input.givers, traits);
  const boonRarityBases = normalizeBoonRarityBases(input.boonRarityBases);
  for (const aspect of aspects.values) {
    const starting = aspect.startingTrait;
    if (starting === undefined) continue;
    const giver = givers.byKey[starting.giverKey];
    if (giver === undefined)
      fail(`aspects.${aspect.key}.startingTrait.giverKey`, 'unknown trait giver');
    if (giver.providerKind !== 'spell')
      fail(`aspects.${aspect.key}.startingTrait.giverKey`, 'must identify a spell provider');
    if (traits.byKey[starting.traitKey] === undefined)
      fail(`aspects.${aspect.key}.startingTrait.traitKey`, 'unknown trait');
    if (traits.byKey[starting.traitKey]?.equipmentSlot !== 'Spell')
      fail(`aspects.${aspect.key}.startingTrait.traitKey`, 'must occupy the Spell equipment slot');
    if (giver.traitKeys.includes(starting.traitKey))
      fail(
        `aspects.${aspect.key}.startingTrait.traitKey`,
        'must not belong to the normal spell pool',
      );
  }
  validateDirectTraitSets(traits, givers);
  validateTravelDeal(traits);
  const echoLastRunBoon = normalizeEchoLastRunBoon(input.echoLastRunBoon, traits, givers);
  const offerContexts = normalizeContexts(input.offerContexts);
  return Object.freeze({
    rarityOrder: Object.freeze(['Common', 'Rare', 'Epic', 'Heroic'] as const),
    elements: Object.freeze([...ELEMENTS]),
    baseElements: Object.freeze([...BASE_ELEMENTS] as ['Earth', 'Air', 'Fire', 'Water']),
    offerContexts,
    weapons,
    aspects,
    traits,
    givers,
    boonRarityBases,
    echoLastRunBoon,
  });
}
