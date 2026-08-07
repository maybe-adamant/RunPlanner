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
  RawTraitOfferDefaults,
  RawTraitOfferOptionDefault,
  RawWeaponDeclaration,
} from '../declarations/traits';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const FRESH_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const;
const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const BASE_ELEMENTS = ['Earth', 'Air', 'Fire', 'Water'] as const;
const ORDINARY_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;
const CONTEXTS = ['devotionNoDuo', 'blockGiftBoons'] as const;
/** Deferred operands are compiler facts, never normalized catalog products. */
const COMPILER_LOCAL_DEFERRED_TRAIT_KEYS = ['HadesCastProjectileBoon', 'CastLobBoon'] as const;

type RawTraitRequirement = {
  readonly kind: string;
  readonly requirements: readonly TraitRequirementExpression[];
  readonly traitKeys: readonly string[];
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
    case 'superchargeableTrait':
      return Object.freeze({ kind: requirement.kind });
    case 'offerContext':
      return Object.freeze({
        kind: 'offerContext',
        context: closedValue(requirement.context, CONTEXTS, `${path}.context`),
        required:
          typeof requirement.required === 'boolean'
            ? requirement.required
            : fail(`${path}.required`, 'must be boolean'),
      });
    default:
      fail(`${path}.kind`, `unknown requirement kind ${String(requirement.kind)}`);
  }
}

function normalizeDefaults(
  defaults: TraitOfferDefaults,
  giver: Pick<TraitGiverDeclaration, 'traitKeys'>,
  traits: CatalogCollection<TraitDeclaration>,
  path: string,
): TraitOfferDefaults {
  const declaration = requireObject(defaults, path) as unknown as RawTraitOfferDefaults;
  const rawOptions = requireArray(declaration.options, `${path}.options`);
  if (rawOptions.length !== 3) fail(`${path}.options`, 'must contain exactly three options');
  const options = rawOptions.map((rawOption, index): TraitOfferOptionDefault => {
    const optionPath = `${path}.options[${index}]`;
    const option = requireObject(rawOption, optionPath) as unknown as RawTraitOfferOptionDefault;
    const traitKey = requireNonEmpty(option.traitKey, `${optionPath}.traitKey`);
    if (!giver.traitKeys.includes(traitKey))
      fail(`${optionPath}.traitKey`, 'must belong to giver pool');
    const trait = traits.byKey[traitKey];
    if (trait === undefined) fail(`${optionPath}.traitKey`, `unknown trait ${traitKey}`);
    if (trait.rarityDomain.kind === 'none') {
      if (option.rarity !== undefined) {
        fail(`${optionPath}.rarity`, `Hammer trait ${traitKey} has no rarity`);
      }
      return Object.freeze({ traitKey });
    }
    const rarity = closedValue(option.rarity, RARITIES, `${optionPath}.rarity`);
    if (!trait.rarityDomain.freshOfferRarities.includes(rarity)) {
      fail(`${optionPath}.rarity`, `${rarity} is not a fresh rarity for ${traitKey}`);
    }
    return Object.freeze({ traitKey, rarity });
  });
  if (new Set(options.map((option) => option.traitKey)).size !== 3) {
    fail(`${path}.options`, 'trait keys must be distinct');
  }
  if (![0, 1, 2].includes(declaration.selectedOption)) {
    fail(`${path}.selectedOption`, 'must be 0, 1, or 2');
  }
  return Object.freeze({
    options: Object.freeze(options) as TraitOfferDefaults['options'],
    selectedOption: declaration.selectedOption,
  });
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
    if (!isHammer && (freshOfferRarities.length === 0 || equippedRarities.length === 0)) {
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
      ) as unknown as NonNullable<RawTraitDeclaration['hammerCompatibility']>;
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
      hammerCompatibility = Object.freeze({ weaponKey, aspectKeys });
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
    // Requirement operands are checked against the complete trait collection after it exists.
    const rarityDomain = isHammer
      ? ({ kind: 'none' } as const)
      : ({
          kind: 'ranked' as const,
          freshOfferRarities: Object.freeze(freshOfferRarities),
          equippedRarities: Object.freeze(equippedRarities),
        } as const);
    if (isHammer && (freshOfferRarities.length !== 0 || equippedRarities.length !== 0)) {
      fail(`${path}.freshOfferRarities`, 'Hammer traits have no rarity domain');
    }
    return Object.freeze({
      key: requireNonEmpty(trait.key, `${path}.key`),
      label: requireNonEmpty(trait.label, `${path}.label`),
      rarityDomain,
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
      isPersistentGodTrait: requireBoolean(
        trait.isPersistentGodTrait,
        `${path}.isPersistentGodTrait`,
      ),
      blockStacking: requireBoolean(trait.blockStacking, `${path}.blockStacking`),
      blockInRunRarify: requireBoolean(trait.blockInRunRarify, `${path}.blockInRunRarify`),
      excludeFromRarityCount: requireBoolean(
        trait.excludeFromRarityCount,
        `${path}.excludeFromRarityCount`,
      ),
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
  const declarations = requireArray(raw, 'givers').map(
    (value, index) =>
      requireObject(value, `givers[${index}]`) as unknown as RawTraitGiverDeclaration,
  );
  const values = declarations.map((giver, index) => {
    const path = `givers[${index}]`;
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
    const providerKind = closedValue(
      giver.providerKind,
      ['olympian', 'hermes', 'hammer'] as const,
      `${path}.providerKind`,
    );
    const rarityPolicy = requireObject(
      giver.rarityPolicy,
      `${path}.rarityPolicy`,
    ) as unknown as RawTraitGiverDeclaration['rarityPolicy'];
    const rarityDomain =
      rarityPolicy.kind === 'none'
        ? ({ kind: 'none' } as const)
        : rarityPolicy.kind === 'selectable'
          ? {
              kind: 'ranked' as const,
              freshOfferRarities: Object.freeze(
                freezeUniqueStrings(
                  requireArray(
                    rarityPolicy.rarities,
                    `${path}.rarityPolicy.rarities`,
                  ) as readonly string[],
                  `${path}.rarityPolicy.rarities`,
                ).map((rarity, rarityIndex) =>
                  closedValue(
                    rarity,
                    ['Common', 'Rare', 'Epic'] as const,
                    `${path}.rarityPolicy.rarities[${rarityIndex}]`,
                  ),
                ),
              ),
              equippedRarities: Object.freeze(['Common', 'Rare', 'Epic', 'Heroic'] as const),
            }
          : fail(`${path}.rarityPolicy`, 'fixed rarity authorship is not supported');
    const normalizedRarityDomain = Object.freeze(rarityDomain);
    if (providerKind === 'hammer' && normalizedRarityDomain.kind !== 'none')
      fail(`${path}.rarityPolicy`, 'Hammer givers require no rarity authorship');
    if (providerKind !== 'hammer' && normalizedRarityDomain.kind !== 'ranked')
      fail(`${path}.rarityPolicy`, 'Olympian and Hermes givers require ranked rarity authorship');
    if (providerKind === 'hammer' && giver.defaultsByLoadout === undefined)
      fail(`${path}.defaultsByLoadout`, 'must cover every loadout');
    if (providerKind !== 'hammer' && giver.defaultOffer === undefined)
      fail(`${path}.defaultOffer`, 'is required');
    const defaultOffer =
      giver.defaultOffer === undefined
        ? undefined
        : normalizeDefaults(giver.defaultOffer, { traitKeys }, traits, `${path}.defaultOffer`);
    const validateDefaultPolicy = (defaults: TraitOfferDefaults, defaultsPath: string): void => {
      defaults.options.forEach((option, optionIndex) => {
        const trait = traits.byKey[option.traitKey];
        if (
          normalizedRarityDomain.kind === 'ranked' &&
          option.rarity !== undefined &&
          !(normalizedRarityDomain.freshOfferRarities as readonly TraitRarity[]).includes(
            option.rarity,
          ) &&
          !(
            trait?.rarityDomain.kind === 'ranked' &&
            trait.rarityDomain.freshOfferRarities.length === 1 &&
            trait.rarityDomain.freshOfferRarities[0] === option.rarity
          )
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
      const rawDefaultsByLoadout = requireObject(
        giver.defaultsByLoadout,
        `${path}.defaultsByLoadout`,
      ) as unknown as NonNullable<RawTraitGiverDeclaration['defaultsByLoadout']>;
      const expectedLoadouts = new Set(
        weapons.values.flatMap((weapon) =>
          weapon.aspectKeys.map((aspectKey) => `${weapon.key}:${aspectKey}`),
        ),
      );
      for (const loadout of Object.keys(rawDefaultsByLoadout)) {
        if (!expectedLoadouts.has(loadout))
          fail(`${path}.defaultsByLoadout.${loadout}`, 'unknown loadout');
      }
      for (const weapon of weapons.values) {
        for (const aspectKey of weapon.aspectKeys) {
          const loadout = `${weapon.key}:${aspectKey}`;
          const defaults = rawDefaultsByLoadout[loadout];
          if (defaults === undefined) fail(`${path}.defaultsByLoadout`, `missing ${loadout}`);
          const normalized = normalizeDefaults(
            defaults,
            { traitKeys },
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
      rarityPolicy: normalizedRarityDomain,
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
  const declaredDeferred = freezeUniqueStrings(
    requireArray(input.deferredTraitKeys, 'deferredTraitKeys') as readonly string[],
    'deferredTraitKeys',
  );
  const deferred = new Set([...declaredDeferred, ...COMPILER_LOCAL_DEFERRED_TRAIT_KEYS]);
  const weapons = normalizeWeapons(input.weapons);
  const aspects = normalizeAspects(input.aspects, weapons);
  const traits = normalizeTraits(input.traits, weapons, aspects, deferred);
  for (const key of declaredDeferred) {
    if (traits.byKey[key] !== undefined) {
      fail('deferredTraitKeys', `${key} is also an included trait`);
    }
  }
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
  });
}
