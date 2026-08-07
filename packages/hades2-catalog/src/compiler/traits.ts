import type {
  AspectDeclaration,
  CatalogCollection,
  HammerCompatibility,
  TraitCatalog,
  TraitDeclaration,
  TraitGiverDeclaration,
  TraitOfferContextDeclaration,
  TraitOfferDefaults,
  TraitOfferOptionDefault,
  TraitRequirementExpression,
  TraitElement,
  TraitRarity,
  WeaponDeclaration,
} from '@run-planner/engine/catalog-schema';

import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import type { RawTraitCatalogInput } from '../declarations/traits';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const FRESH_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const;
const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const BASE_ELEMENTS = ['Earth', 'Air', 'Fire', 'Water'] as const;
const ORDINARY_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;
const CONTEXTS = ['devotionNoDuo', 'blockGiftBoons'] as const;

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

function normalizeRequirement(
  raw: TraitRequirementExpression,
  traits: CatalogCollection<TraitDeclaration>,
  deferred: ReadonlySet<string>,
  path: string,
): TraitRequirementExpression {
  switch (raw.kind) {
    case 'all':
      if (raw.requirements.length === 0) fail(path, 'must not be empty');
      return Object.freeze({
        kind: 'all',
        requirements: Object.freeze(
          raw.requirements.map((child, index) =>
            normalizeRequirement(child, traits, deferred, `${path}.requirements[${index}]`),
          ),
        ),
      });
    case 'anyEquippedTrait':
    case 'notEquippedTrait': {
      const traitKeys = freezeUniqueStrings(raw.traitKeys, `${path}.traitKeys`);
      for (const [index, traitKey] of traitKeys.entries()) {
        if (traits.byKey[traitKey] === undefined && !deferred.has(traitKey)) {
          fail(`${path}.traitKeys[${index}]`, `unknown trait operand ${traitKey}`);
        }
      }
      return Object.freeze({ kind: raw.kind, traitKeys });
    }
    case 'elementCount':
      return Object.freeze({
        kind: 'elementCount',
        element: closedValue(raw.element, ELEMENTS, `${path}.element`),
        minimum: requirePositiveInteger(raw.minimum, `${path}.minimum`),
      });
    case 'highestBaseElementCount':
      return Object.freeze({
        kind: 'highestBaseElementCount',
        minimum: requirePositiveInteger(raw.minimum, `${path}.minimum`),
      });
    case 'godBoonRarityCount':
      if (!Number.isInteger(raw.minimum) || raw.minimum < 0)
        fail(`${path}.minimum`, 'must be a non-negative integer');
      if (
        raw.maximum !== undefined &&
        (!Number.isInteger(raw.maximum) || raw.maximum < raw.minimum)
      ) {
        fail(`${path}.maximum`, 'must be an integer greater than or equal to minimum');
      }
      return Object.freeze({
        kind: 'godBoonRarityCount',
        rarity: closedValue(raw.rarity, RARITIES, `${path}.rarity`),
        minimum: raw.minimum,
        ...(raw.maximum === undefined ? {} : { maximum: raw.maximum }),
      });
    case 'rarifiableTrait':
    case 'superchargeableTrait':
      return Object.freeze({ kind: raw.kind });
    case 'offerContext':
      return Object.freeze({
        kind: 'offerContext',
        context: closedValue(raw.context, CONTEXTS, `${path}.context`),
        required:
          typeof raw.required === 'boolean'
            ? raw.required
            : fail(`${path}.required`, 'must be boolean'),
      });
  }
}

function normalizeDefaults(
  defaults: TraitOfferDefaults,
  giver: TraitGiverDeclaration,
  traits: CatalogCollection<TraitDeclaration>,
  path: string,
): TraitOfferDefaults {
  if (defaults.options.length !== 3) fail(`${path}.options`, 'must contain exactly three options');
  const options = defaults.options.map((option, index): TraitOfferOptionDefault => {
    const optionPath = `${path}.options[${index}]`;
    const traitKey = requireNonEmpty(option.traitKey, `${optionPath}.traitKey`);
    if (!giver.traitKeys.includes(traitKey))
      fail(`${optionPath}.traitKey`, 'must belong to giver pool');
    const trait = traits.byKey[traitKey];
    if (trait === undefined) fail(`${optionPath}.traitKey`, `unknown trait ${traitKey}`);
    const rarity = closedValue(option.rarity, RARITIES, `${optionPath}.rarity`);
    if (!trait.freshOfferRarities.includes(rarity)) {
      fail(`${optionPath}.rarity`, `${rarity} is not a fresh rarity for ${traitKey}`);
    }
    return Object.freeze({ traitKey, rarity });
  });
  if (new Set(options.map((option) => option.traitKey)).size !== 3) {
    fail(`${path}.options`, 'trait keys must be distinct');
  }
  if (![0, 1, 2].includes(defaults.selectedOption)) {
    fail(`${path}.selectedOption`, 'must be 0, 1, or 2');
  }
  return Object.freeze({
    options: Object.freeze(options) as TraitOfferDefaults['options'],
    selectedOption: defaults.selectedOption,
  });
}

function normalizeWeapons(
  raw: RawTraitCatalogInput['weapons'],
): CatalogCollection<WeaponDeclaration> {
  const values = raw.map((weapon, index) => {
    const path = `weapons[${index}]`;
    const aspectKeys = freezeUniqueStrings(weapon.aspectKeys, `${path}.aspectKeys`);
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
  const values = raw.map((aspect, index) => {
    const path = `aspects[${index}]`;
    const weaponKey = requireNonEmpty(aspect.weaponKey, `${path}.weaponKey`);
    if (weapons.byKey[weaponKey] === undefined)
      fail(`${path}.weaponKey`, `unknown weapon ${weaponKey}`);
    return Object.freeze({
      key: requireNonEmpty(aspect.key, `${path}.key`),
      label: requireNonEmpty(aspect.label, `${path}.label`),
      weaponKey,
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

function normalizeTraits(
  raw: RawTraitCatalogInput['traits'],
  weapons: CatalogCollection<WeaponDeclaration>,
  aspects: CatalogCollection<AspectDeclaration>,
  deferred: ReadonlySet<string>,
): CatalogCollection<TraitDeclaration> {
  const declaredKeys = new Set(raw.map((trait) => trait.key));
  const declarationContact = {
    values: [],
    byKey: Object.fromEntries([...declaredKeys].map((key) => [key, {} as TraitDeclaration])),
  } as CatalogCollection<TraitDeclaration>;
  const values = raw.map((trait, index) => {
    const path = `traits[${index}]`;
    const freshOfferRarities = freezeUniqueStrings(
      trait.freshOfferRarities,
      `${path}.freshOfferRarities`,
    ) as TraitRarity[];
    const equippedRarities = freezeUniqueStrings(
      trait.equippedRarities,
      `${path}.equippedRarities`,
    ) as TraitRarity[];
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
    for (const [element, count] of Object.entries(trait.elementContributions)) {
      const normalizedElement = closedValue(
        element,
        ELEMENTS,
        `${path}.elementContributions.${element}`,
      );
      if (count === undefined || !Number.isInteger(count) || count <= 0)
        fail(`${path}.elementContributions.${element}`, 'must be a positive integer');
      elementContributions[normalizedElement] = count;
    }
    let hammerCompatibility: HammerCompatibility | undefined;
    if (trait.hammerCompatibility !== undefined) {
      const weaponKey = requireNonEmpty(
        trait.hammerCompatibility.weaponKey,
        `${path}.hammerCompatibility.weaponKey`,
      );
      const weapon = weapons.byKey[weaponKey];
      if (weapon === undefined)
        fail(`${path}.hammerCompatibility.weaponKey`, `unknown weapon ${weaponKey}`);
      const aspectKeys = freezeUniqueStrings(
        trait.hammerCompatibility.aspectKeys,
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
      hammerCompatibility = Object.freeze({ weaponKey, aspectKeys });
    }
    const offerRequirements = Object.freeze(
      trait.offerRequirements.map((requirement, requirementIndex) =>
        normalizeRequirement(
          requirement,
          declarationContact,
          deferred,
          `${path}.offerRequirements[${requirementIndex}]`,
        ),
      ),
    );
    // Requirement operands are checked against the complete trait collection after it exists.
    return Object.freeze({
      key: requireNonEmpty(trait.key, `${path}.key`),
      label: requireNonEmpty(trait.label, `${path}.label`),
      freshOfferRarities: Object.freeze(freshOfferRarities),
      equippedRarities: Object.freeze(equippedRarities),
      offerRequirements,
      ...(trait.ordinaryBoonSlot === undefined
        ? {}
        : {
            ordinaryBoonSlot: closedValue(
              trait.ordinaryBoonSlot,
              ORDINARY_SLOTS,
              `${path}.ordinaryBoonSlot`,
            ),
          }),
      elementContributions: Object.freeze(elementContributions),
      isPersistentGodTrait: trait.isPersistentGodTrait,
      blockStacking: trait.blockStacking,
      blockInRunRarify: trait.blockInRunRarify,
      excludeFromRarityCount: trait.excludeFromRarityCount,
      ...(trait.selfExclusion === undefined
        ? {}
        : { selfExclusion: requireNonEmpty(trait.selfExclusion, `${path}.selfExclusion`) }),
      ...(hammerCompatibility === undefined ? {} : { hammerCompatibility }),
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

function normalizeGivers(
  raw: RawTraitCatalogInput['givers'],
  traits: CatalogCollection<TraitDeclaration>,
  weapons: CatalogCollection<WeaponDeclaration>,
  aspects: CatalogCollection<AspectDeclaration>,
): CatalogCollection<TraitGiverDeclaration> {
  const values = raw.map((giver, index) => {
    const path = `givers[${index}]`;
    const traitKeys = freezeUniqueStrings(giver.traitKeys, `${path}.traitKeys`);
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
      if (
        giver.providerKind === 'hammer' &&
        (trait.freshOfferRarities.length !== 1 || trait.freshOfferRarities[0] !== 'Common')
      )
        fail(`${path}.traitKeys[${memberIndex}]`, 'Hammer members must have fixed Common rarity');
      if (giver.providerKind !== 'hammer' && trait.hammerCompatibility !== undefined)
        fail(`${path}.traitKeys[${memberIndex}]`, 'non-Hammer giver cannot contain a Hammer trait');
    }
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer'] as const,
      `${path}.providerKind`,
    );
    const rarityPolicy =
      giver.rarityPolicy.kind === 'fixed'
        ? {
            kind: 'fixed' as const,
            rarity: closedValue(giver.rarityPolicy.rarity, RARITIES, `${path}.rarityPolicy.rarity`),
          }
        : {
            kind: 'selectable' as const,
            rarities: Object.freeze(
              freezeUniqueStrings(giver.rarityPolicy.rarities, `${path}.rarityPolicy.rarities`).map(
                (rarity, rarityIndex) =>
                  closedValue(
                    rarity,
                    ['Common', 'Rare', 'Epic'] as const,
                    `${path}.rarityPolicy.rarities[${rarityIndex}]`,
                  ),
              ),
            ),
          };
    const normalizedRarityPolicy = Object.freeze(rarityPolicy);
    if (providerKind === 'hammer' && normalizedRarityPolicy.kind !== 'fixed')
      fail(`${path}.rarityPolicy`, 'Hammer givers require fixed rarity authorship');
    if (providerKind !== 'hammer' && normalizedRarityPolicy.kind !== 'selectable')
      fail(
        `${path}.rarityPolicy`,
        'Olympian and Hermes givers require selectable rarity authorship',
      );
    if (providerKind === 'hammer' && giver.defaultsByLoadout === undefined)
      fail(`${path}.defaultsByLoadout`, 'must cover every loadout');
    if (providerKind !== 'hammer' && giver.defaultOffer === undefined)
      fail(`${path}.defaultOffer`, 'is required');
    const defaultOffer =
      giver.defaultOffer === undefined
        ? undefined
        : normalizeDefaults(
            giver.defaultOffer,
            { ...giver, providerKind, traitKeys } as TraitGiverDeclaration,
            traits,
            `${path}.defaultOffer`,
          );
    const validateDefaultPolicy = (defaults: TraitOfferDefaults, defaultsPath: string): void => {
      defaults.options.forEach((option, optionIndex) => {
        if (
          normalizedRarityPolicy.kind === 'fixed' &&
          option.rarity !== normalizedRarityPolicy.rarity
        ) {
          fail(
            `${defaultsPath}.options[${optionIndex}].rarity`,
            `must use fixed ${normalizedRarityPolicy.rarity}`,
          );
        }
        if (
          normalizedRarityPolicy.kind === 'selectable' &&
          !(normalizedRarityPolicy.rarities as readonly TraitRarity[]).includes(option.rarity) &&
          traits.byKey[option.traitKey]?.freshOfferRarities.length !== 1
        ) {
          fail(
            `${defaultsPath}.options[${optionIndex}].rarity`,
            `${option.rarity} is outside the giver rarity domain`,
          );
        }
      });
    };
    if (defaultOffer !== undefined) validateDefaultPolicy(defaultOffer, `${path}.defaultOffer`);
    const defaultsByLoadout: Record<string, TraitOfferDefaults> = {};
    if (giver.defaultsByLoadout !== undefined) {
      const expectedLoadouts = new Set(
        weapons.values.flatMap((weapon) =>
          weapon.aspectKeys.map((aspectKey) => `${weapon.key}:${aspectKey}`),
        ),
      );
      for (const loadout of Object.keys(giver.defaultsByLoadout)) {
        if (!expectedLoadouts.has(loadout))
          fail(`${path}.defaultsByLoadout.${loadout}`, 'unknown loadout');
      }
      for (const weapon of weapons.values) {
        for (const aspectKey of weapon.aspectKeys) {
          const loadout = `${weapon.key}:${aspectKey}`;
          const defaults = giver.defaultsByLoadout[loadout];
          if (defaults === undefined) fail(`${path}.defaultsByLoadout`, `missing ${loadout}`);
          const normalized = normalizeDefaults(
            defaults,
            { ...giver, providerKind, traitKeys } as TraitGiverDeclaration,
            traits,
            `${path}.defaultsByLoadout.${loadout}`,
          );
          validateDefaultPolicy(normalized, `${path}.defaultsByLoadout.${loadout}`);
          for (const option of normalized.options) {
            const aspect = aspects.byKey[aspectKey];
            const trait = traits.byKey[option.traitKey];
            if (
              aspect === undefined ||
              trait?.hammerCompatibility?.weaponKey !== weapon.key ||
              !trait.hammerCompatibility.aspectKeys.includes(aspect.key)
            ) {
              fail(
                `${path}.defaultsByLoadout.${loadout}`,
                `option ${option.traitKey} is incompatible`,
              );
            }
          }
          defaultsByLoadout[loadout] = normalized;
        }
      }
    }
    return Object.freeze({
      key: requireNonEmpty(giver.key, `${path}.key`),
      label: requireNonEmpty(giver.label, `${path}.label`),
      providerKind,
      traitKeys,
      rarityPolicy,
      ...(defaultOffer === undefined ? {} : { defaultOffer }),
      ...(Object.keys(defaultsByLoadout).length === 0
        ? {}
        : { defaultsByLoadout: Object.freeze(defaultsByLoadout) }),
    });
  });
  return createCollection(values, 'givers', (giver) => giver.key);
}

function normalizeContexts(
  raw: RawTraitCatalogInput['offerContexts'],
): CatalogCollection<TraitOfferContextDeclaration> {
  const values = raw.map((context, index) => {
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
    return Object.freeze({
      key,
      kind: context.kind,
      ...(context.blockedRarity === undefined
        ? {}
        : { blockedRarity: closedValue(context.blockedRarity, RARITIES, `${path}.blockedRarity`) }),
      ...(context.roomFlag === undefined ? {} : { roomFlag: context.roomFlag }),
    });
  });
  const collection = createCollection(values, 'offerContexts', (context) => context.key);
  for (const key of CONTEXTS)
    if (collection.byKey[key] === undefined) fail('offerContexts', `missing ${key}`);
  return collection;
}

export function createTraitCatalog(input: RawTraitCatalogInput): TraitCatalog {
  const deferred = new Set(freezeUniqueStrings(input.deferredTraitKeys, 'deferredTraitKeys'));
  const weapons = normalizeWeapons(input.weapons);
  const aspects = normalizeAspects(input.aspects, weapons);
  const traits = normalizeTraits(input.traits, weapons, aspects, deferred);
  const givers = normalizeGivers(input.givers, traits, weapons, aspects);
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
    deferredTraitKeys: Object.freeze([...deferred]),
  });
}
