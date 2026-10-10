import type {
  CatalogCollection,
  HammerCompatibility,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitDeclaration,
  TraitElement,
  TraitMaxStatEffect,
  TraitMaxStatValue,
  TraitRarity,
  TraitRequirementExpression,
} from '@run-planner/engine/catalog-schema';

import type {
  RawMaxStatValue,
  RawTraitCatalogInput,
  RawTraitDeclaration,
  RawTraitMaxStatEffect,
} from '../../declarations/traits/types';
import {
  createCollection,
  freezeUniqueStrings,
  requireArray,
  requireBoolean,
  requireNonEmpty,
  requireObject,
  requirePositiveInteger,
} from '../common';
import { fail } from '../errors';
import { normalizeRequirement, normalizeSelectedDisposition } from './dispositions';

const RARITIES = ['Common', 'Rare', 'Epic', 'Heroic', 'Legendary', 'Duo'] as const;
const IN_RUN_RARITIES = ['Common', 'Rare', 'Epic', 'Heroic'] as const;
const COOLDOWN_CAPPED_IN_RUN_UPGRADE_TRAITS = new Set([
  'HephaestusWeaponBoon',
  'HephaestusSpecialBoon',
  'HephaestusSprintBoon',
]);
const BLOCK_OFFER_IF_PREVIOUSLY_PICKED_TRAITS = new Set([
  'BoonDecayBoon',
  'KeepsakeLevelBoon',
  'RoomRewardBonusBoon',
]);
/** Resolves `1 + (base - 1) * rarity multiplier` for every equipped rarity. */
function normalizeResourceRewardBonus(
  raw: NonNullable<RawTraitDeclaration['resourceRewardBonus']>,
  equippedRarities: readonly TraitRarity[],
  path: string,
): NonNullable<TraitDeclaration['resourceRewardBonus']> {
  const resources = freezeUniqueStrings(raw.resources, `${path}.resources`);
  if (resources.length === 0) fail(`${path}.resources`, 'must not be empty');
  if (typeof raw.baseValue !== 'number' || !(raw.baseValue > 1))
    fail(`${path}.baseValue`, 'must be a multiplier above 1');
  const scales = requireObject(raw.rarityMultipliers, `${path}.rarityMultipliers`);
  const rarities = IN_RUN_RARITIES.filter((rarity) => equippedRarities.includes(rarity));
  if (
    rarities.length !== equippedRarities.length ||
    Object.keys(scales).length !== rarities.length ||
    rarities.some(
      (rarity) => typeof scales[rarity] !== 'number' || !((scales[rarity] as number) > 0),
    )
  )
    fail(`${path}.rarityMultipliers`, 'must scale exactly this trait equipped ranked rarities');
  const byRarity = Object.freeze(
    Object.fromEntries(
      rarities.map((rarity) => [rarity, 1 + (raw.baseValue - 1) * (scales[rarity] as number)]),
    ),
  ) as Readonly<Record<(typeof IN_RUN_RARITIES)[number], number>>;
  return Object.freeze(Object.fromEntries(resources.map((resource) => [resource, byRarity])));
}

/** Scales each roll bound by its rarity multiplier; every bound must land on an integer. */
function normalizeAcquisitionMaxHealthRoll(
  raw: NonNullable<RawTraitDeclaration['acquisitionMaxHealthRoll']>,
  equippedRarities: readonly TraitRarity[],
  path: string,
): NonNullable<TraitDeclaration['acquisitionMaxHealthRoll']> {
  requireObject(raw, path);
  if (Object.keys(raw).length !== 2) fail(path, 'requires only minimum and maximum');
  const rarities = IN_RUN_RARITIES.filter((rarity) => equippedRarities.includes(rarity));
  if (rarities.length !== IN_RUN_RARITIES.length || equippedRarities.length !== rarities.length)
    fail(path, 'requires a trait equipped at exactly Common, Rare, Epic and Heroic');
  const scaled = (bound: 'minimum' | 'maximum', rarity: (typeof IN_RUN_RARITIES)[number]) => {
    const value = requireObject(raw[bound], `${path}.${bound}`);
    const multipliers = requireObject(
      value.rarityMultipliers,
      `${path}.${bound}.rarityMultipliers`,
    );
    if (Object.keys(multipliers).length !== rarities.length)
      fail(`${path}.${bound}.rarityMultipliers`, 'must scale exactly the equipped rarities');
    const base = requirePositiveInteger(value.baseValue as number, `${path}.${bound}.baseValue`);
    const multiplier = multipliers[rarity];
    if (typeof multiplier !== 'number' || !(multiplier > 0))
      fail(`${path}.${bound}.rarityMultipliers.${rarity}`, 'must be a positive multiplier');
    const product = base * multiplier;
    const rounded = Math.round(product);
    if (Math.abs(product - rounded) > 1e-9)
      fail(`${path}.${bound}.rarityMultipliers.${rarity}`, 'must scale to an integer');
    return rounded;
  };
  const ranges = rarities.map((rarity) => {
    const minimum = scaled('minimum', rarity);
    const maximum = scaled('maximum', rarity);
    if (minimum > maximum) fail(`${path}.${rarity}`, 'minimum must not exceed maximum');
    return { rarity, minimum, width: maximum - minimum };
  });
  const width = ranges[0]!.width;
  if (ranges.some((range) => range.width !== width))
    fail(path, 'every rarity must span the same roll width');
  return Object.freeze({
    minimumByRarity: Object.freeze(
      Object.fromEntries(ranges.map((range) => [range.rarity, range.minimum])),
    ) as NonNullable<TraitDeclaration['acquisitionMaxHealthRoll']>['minimumByRarity'],
    width,
  });
}

function normalizeMaxStatValue(
  raw: RawMaxStatValue,
  equippedRarities: readonly TraitRarity[],
  path: string,
): TraitMaxStatValue {
  if (typeof raw === 'number') {
    if (equippedRarities.length > 0) fail(path, 'a ranked trait must scale by rarity');
    if (!Number.isFinite(raw) || !(raw > 0)) fail(path, 'must be a positive number');
    return raw;
  }
  const value = requireObject(raw, path);
  if (
    Object.keys(value).some(
      (key) => !['baseValue', 'rarityMultipliers', 'sourceIsMultiplier'].includes(key),
    )
  )
    fail(path, 'has an unsupported key');
  if (raw.sourceIsMultiplier !== undefined && raw.sourceIsMultiplier !== true)
    fail(`${path}.sourceIsMultiplier`, 'must be true when declared');
  if (typeof raw.baseValue !== 'number' || !(raw.baseValue > 0))
    fail(`${path}.baseValue`, 'must be a positive number');
  const scales = requireObject(raw.rarityMultipliers, `${path}.rarityMultipliers`);
  const rarities = IN_RUN_RARITIES.filter((rarity) => equippedRarities.includes(rarity));
  if (
    rarities.length === 0 ||
    rarities.length !== equippedRarities.length ||
    Object.keys(scales).length !== rarities.length ||
    rarities.some(
      (rarity) => typeof scales[rarity] !== 'number' || !((scales[rarity] as number) > 0),
    )
  )
    fail(`${path}.rarityMultipliers`, 'must scale exactly this trait equipped ranked rarities');
  // ProcessValue rounds each ramped value to two decimals (TraitLogic.lua ProcessValue).
  const scaled = (rarity: (typeof IN_RUN_RARITIES)[number]) => {
    const multiplier = scales[rarity] as number;
    const value =
      raw.sourceIsMultiplier === true
        ? 1 + (raw.baseValue - 1) * multiplier
        : raw.baseValue * multiplier;
    return Math.floor(value * 100 + 0.5) / 100;
  };
  return Object.freeze(
    Object.fromEntries(rarities.map((rarity) => [rarity, scaled(rarity)])),
  ) as Readonly<Record<(typeof IN_RUN_RARITIES)[number], number>>;
}

function normalizeMaxStatEffect(
  raw: RawTraitMaxStatEffect,
  equippedRarities: readonly TraitRarity[],
  elementalMultiplier: TraitElement | undefined,
  path: string,
): TraitMaxStatEffect {
  requireObject(raw, path);
  const exact = (keys: readonly string[]) => {
    const extra = Object.keys(raw).find((key) => !keys.includes(key));
    if (extra !== undefined) fail(`${path}.${extra}`, 'is not supported');
  };
  switch (raw.kind) {
    case 'multiplier': {
      exact(['kind', 'maxHealth', 'maxMana']);
      if (raw.maxHealth === undefined && raw.maxMana === undefined)
        fail(path, 'must multiply at least one maximum');
      return Object.freeze({
        kind: raw.kind,
        ...(raw.maxHealth === undefined
          ? {}
          : {
              maxHealth: normalizeMaxStatValue(
                raw.maxHealth,
                equippedRarities,
                `${path}.maxHealth`,
              ),
            }),
        ...(raw.maxMana === undefined
          ? {}
          : { maxMana: normalizeMaxStatValue(raw.maxMana, equippedRarities, `${path}.maxMana`) }),
      });
    }
    case 'manaToHealthConversion':
      exact(['kind', 'fraction']);
      return Object.freeze({
        kind: raw.kind,
        fraction: normalizeMaxStatValue(raw.fraction, equippedRarities, `${path}.fraction`),
      });
    case 'perElement':
      exact(['kind', 'stat', 'amount']);
      if (raw.stat !== 'maxHealth' && raw.stat !== 'maxMana')
        fail(`${path}.stat`, 'must be maxHealth or maxMana');
      if (elementalMultiplier === undefined)
        fail(path, 'a perElement effect requires an elementalMultiplier');
      return Object.freeze({
        kind: raw.kind,
        element: elementalMultiplier,
        stat: raw.stat,
        amount: requirePositiveInteger(raw.amount, `${path}.amount`),
      });
    case 'familiarStackMultiplier':
      exact(['kind', 'multiplier']);
      return Object.freeze({
        kind: raw.kind,
        multiplier: requirePositiveInteger(raw.multiplier, `${path}.multiplier`),
      });
    default:
      fail(`${path}.kind`, `unknown max-stat effect ${String((raw as { kind?: unknown }).kind)}`);
  }
}

const FRESH_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Duo'] as const;
const ELEMENTS = ['Aether', 'Earth', 'Air', 'Fire', 'Water'] as const;
const EQUIPMENT_SLOTS = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana', 'Spell'] as const;

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

function normalizeActivationRequirement(
  raw: unknown,
  path: string,
): NonNullable<TraitDeclaration['activationRequirement']> {
  const requirement = requireObject(raw, path);
  switch (requirement.kind) {
    case 'elementMinimums': {
      if (Object.keys(requirement).length !== 2 || !('minimums' in requirement))
        fail(path, 'must contain exactly kind and minimums');
      const rawMinimums = requireObject(requirement.minimums, `${path}.minimums`);
      const minimums: Partial<Record<TraitElement, number>> = {};
      for (const [element, minimum] of Object.entries(rawMinimums)) {
        const elementPath = `${path}.minimums.${element}`;
        minimums[closedValue(element, ELEMENTS, elementPath)] = requirePositiveInteger(
          minimum as number,
          elementPath,
        );
      }
      if (Object.keys(minimums).length === 0) fail(`${path}.minimums`, 'must not be empty');
      return Object.freeze({ kind: 'elementMinimums', minimums: Object.freeze(minimums) });
    }
    case 'highestBaseElementCount':
      if (Object.keys(requirement).length !== 2 || !('minimum' in requirement))
        fail(path, 'must contain exactly kind and minimum');
      return Object.freeze({
        kind: 'highestBaseElementCount',
        minimum: requirePositiveInteger(requirement.minimum as number, `${path}.minimum`),
      });
    default:
      fail(`${path}.kind`, `unknown activation requirement ${String(requirement.kind)}`);
  }
}
export function normalizeTraits(
  raw: RawTraitCatalogInput['traits'],
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
      const aspectKeys = freezeUniqueStrings(
        requireArray(
          hammerDeclaration.aspectKeys,
          `${path}.hammerCompatibility.aspectKeys`,
        ) as readonly string[],
        `${path}.hammerCompatibility.aspectKeys`,
      );
      if (aspectKeys.length === 0)
        fail(`${path}.hammerCompatibility.aspectKeys`, 'must not be empty');
      hammerCompatibility = Object.freeze({
        weaponKey,
        aspectKeys,
        supportsRankII: requireBoolean(
          hammerDeclaration.supportsRankII,
          `${path}.hammerCompatibility.supportsRankII`,
        ),
      });
    }
    const normalizeRequirements = (
      requirements: unknown,
      requirementsPath: string,
    ): readonly TraitRequirementExpression[] =>
      Object.freeze(
        (requireArray(requirements, requirementsPath) as readonly TraitRequirementExpression[]).map(
          (requirement, requirementIndex) =>
            normalizeRequirement(
              requirement,
              declarationContact,
              deferred,
              `${requirementsPath}[${requirementIndex}]`,
            ),
        ),
      );
    const eligibilityRequirements = normalizeRequirements(
      trait.eligibilityRequirements,
      `${path}.eligibilityRequirements`,
    );
    const linkedBoonRequirements = normalizeRequirements(
      trait.linkedBoonRequirements,
      `${path}.linkedBoonRequirements`,
    );
    const activationRequirement =
      trait.activationRequirement === undefined
        ? undefined
        : normalizeActivationRequirement(
            trait.activationRequirement,
            `${path}.activationRequirement`,
          );
    const elementalMultiplier =
      trait.elementalMultiplier === undefined
        ? undefined
        : closedValue(trait.elementalMultiplier, ELEMENTS, `${path}.elementalMultiplier`);
    let rarityFloorEffect: ProperUpbringingEffect | undefined;
    if (trait.rarityFloorEffect !== undefined) {
      const effectPath = `${path}.rarityFloorEffect`;
      if (trait.key !== 'ElementalRarityUpgradeBoon')
        fail(effectPath, 'is reserved to ElementalRarityUpgradeBoon');
      if (isRarityless) fail(effectPath, 'rarityless traits cannot declare a rarity floor effect');
      const effect = requireObject(trait.rarityFloorEffect, effectPath) as unknown as {
        readonly fromRarity?: unknown;
        readonly minimumRarity?: unknown;
        readonly boonRarityContribution?: unknown;
      };
      const effectKeys = ['fromRarity', 'minimumRarity', 'boonRarityContribution'];
      if (
        Object.keys(effect).length !== effectKeys.length ||
        effectKeys.some((key) => !(key in effect))
      )
        fail(effectPath, 'must contain exactly the Proper Upbringing effect fields');
      if (activationRequirement === undefined)
        fail(effectPath, 'requires the trait to declare an activationRequirement');
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
        readonly targetCountByAcquisitionOrdinal?: unknown;
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
        targetedAcquisition = Object.freeze({
          kind,
          target: target as 'superchargeableGodTrait',
        });
      } else {
        const counts = requireArray(
          acquisition.targetCountByAcquisitionOrdinal,
          `${acquisitionPath}.targetCountByAcquisitionOrdinal`,
        );
        if (
          Object.keys(acquisition).length !== 3 ||
          counts.length !== 4 ||
          counts.some((count) => !Number.isInteger(count as number) || (count as number) <= 0)
        )
          fail(
            acquisitionPath,
            'upgradeHammerToRank2 requires four positive ordinal target counts',
          );
        targetedAcquisition = Object.freeze({
          kind,
          target: target as 'upgradableHammer',
          targetCountByAcquisitionOrdinal: Object.freeze([...counts]) as [
            number,
            number,
            number,
            number,
          ],
        });
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
    let maximumEligibleLevelByRarity:
      | Readonly<Record<Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>, number>>
      | undefined;
    if (trait.maximumEligibleLevelByRarity !== undefined) {
      if (!COOLDOWN_CAPPED_IN_RUN_UPGRADE_TRAITS.has(trait.key))
        fail(
          `${path}.maximumEligibleLevelByRarity`,
          'is reserved for the three cooldown-capped Hephaestus core traits',
        );
      if (!isCoreGodTrait || trait.blockStacking)
        fail(`${path}.maximumEligibleLevelByRarity`, 'requires a Pom-eligible core god trait');
      const rawLimits = requireObject(
        trait.maximumEligibleLevelByRarity,
        `${path}.maximumEligibleLevelByRarity`,
      );
      const normalized: Partial<Record<TraitRarity, number>> = {};
      for (const [rarity, maximum] of Object.entries(rawLimits)) {
        const normalizedRarity = closedValue(
          rarity,
          IN_RUN_RARITIES,
          `${path}.maximumEligibleLevelByRarity.${rarity}`,
        );
        if (!equippedRarities.includes(normalizedRarity))
          fail(
            `${path}.maximumEligibleLevelByRarity.${rarity}`,
            'must be an equipped rarity of this trait',
          );
        normalized[normalizedRarity] = requirePositiveInteger(
          maximum as number,
          `${path}.maximumEligibleLevelByRarity.${rarity}`,
        );
      }
      if (
        Object.keys(normalized).length !== equippedRarities.length ||
        equippedRarities.some((rarity) => normalized[rarity] === undefined)
      )
        fail(
          `${path}.maximumEligibleLevelByRarity`,
          'must cover exactly this trait equipped ranked rarities',
        );
      maximumEligibleLevelByRarity = Object.freeze(
        normalized as Record<Extract<TraitRarity, 'Common' | 'Rare' | 'Epic' | 'Heroic'>, number>,
      );
    } else if (COOLDOWN_CAPPED_IN_RUN_UPGRADE_TRAITS.has(trait.key)) {
      fail(
        `${path}.maximumEligibleLevelByRarity`,
        'is required for the cooldown-capped Hephaestus core traits',
      );
    }
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
    const icarusSlot =
      trait.key === 'FocusAttackDamageTrait'
        ? 'Melee'
        : trait.key === 'FocusSpecialDamageTrait'
          ? 'Secondary'
          : undefined;
    if (
      icarusSlot !== undefined &&
      (selectedDisposition.kind !== 'upgradeOccupiedBoonSlot' ||
        selectedDisposition.slot !== icarusSlot ||
        selectedDisposition.levelCountByAcquisitionOrdinal.join(',') !== '3,3,3,5')
    )
      fail(
        `${path}.selectedDisposition`,
        `must declare the ${icarusSlot} occupied-slot level upgrade`,
      );
    if (icarusSlot === undefined && selectedDisposition.kind === 'upgradeOccupiedBoonSlot')
      fail(
        `${path}.selectedDisposition`,
        'occupied-slot level upgrades are reserved for Ingenious Strike and Ingenious Flourish',
      );
    const circeCounts =
      trait.key === 'RandomArcanaTrait' || trait.key === 'RemoveShrineTrait'
        ? '1,1,2,3'
        : trait.key === 'ArcanaRarityTrait'
          ? '2,2,3,5'
          : undefined;
    if (
      circeCounts !== undefined &&
      (selectedDisposition.kind !== 'circe' ||
        selectedDisposition.selectionCountByAcquisitionOrdinal.join(',') !== circeCounts)
    )
      fail(`${path}.selectedDisposition`, `must declare Circe ordinal counts ${circeCounts}`);
    if (circeCounts === undefined && selectedDisposition.kind === 'circe')
      fail(
        `${path}.selectedDisposition`,
        'Circe ordinal resolutions are reserved for Circe rewards',
      );
    if (
      trait.key === 'UpgradeHammerBoon' &&
      (targetedAcquisition?.kind !== 'upgradeHammerToRank2' ||
        targetedAcquisition.targetCountByAcquisitionOrdinal.join(',') !== '1,1,1,2')
    )
      fail(
        `${path}.targetedAcquisition`,
        'Latest Model must declare ordinal target counts 1,1,1,2',
      );
    if (trait.key === 'SupplyDropBoon') {
      if (
        selectedDisposition.kind !== 'producePickups' ||
        selectedDisposition.producerLifecycleKey !== 'GeneratedTraitPickup' ||
        selectedDisposition.clock?.kind !== 'qualifyingEncounterEndEffects' ||
        selectedDisposition.clock.intervalByAcquisitionOrdinal.join(',') !== '7,7,7,3' ||
        selectedDisposition.pickups.length !== 2 ||
        selectedDisposition.pickups.some(
          (pickup, index) =>
            pickup.key !== `pom${index + 1}` || pickup.rewardType !== 'StoreRewardRandomStack',
        )
      )
        fail(
          `${path}.selectedDisposition`,
          'must declare the repeating two-Pom Supply Chain producer with 7/7/7/3 intervals',
        );
    } else if (
      selectedDisposition.kind === 'producePickups' &&
      selectedDisposition.clock !== undefined
    ) {
      fail(`${path}.selectedDisposition.clock`, 'is reserved for Supply Chain');
    }
    const resourceRewardBonus =
      trait.resourceRewardBonus === undefined
        ? undefined
        : normalizeResourceRewardBonus(
            trait.resourceRewardBonus,
            equippedRarities,
            `${path}.resourceRewardBonus`,
          );
    const roomsPerUpgradeGrowth =
      trait.roomsPerUpgradeGrowth === undefined
        ? undefined
        : Object.freeze({
            interval: requirePositiveInteger(
              trait.roomsPerUpgradeGrowth.interval,
              `${path}.roomsPerUpgradeGrowth.interval`,
            ),
            maxManaByAcquisitionOrdinal: Object.freeze(
              requireArray(
                trait.roomsPerUpgradeGrowth.maxManaByAcquisitionOrdinal,
                `${path}.roomsPerUpgradeGrowth.maxManaByAcquisitionOrdinal`,
              ).map((amount, index) =>
                requirePositiveInteger(
                  amount as number,
                  `${path}.roomsPerUpgradeGrowth.maxManaByAcquisitionOrdinal[${index}]`,
                ),
              ),
            ) as unknown as readonly [number, number, number, number],
          });
    if (
      roomsPerUpgradeGrowth !== undefined &&
      roomsPerUpgradeGrowth.maxManaByAcquisitionOrdinal.length !== 4
    )
      fail(
        `${path}.roomsPerUpgradeGrowth.maxManaByAcquisitionOrdinal`,
        'must declare four acquisition ordinals',
      );
    if (
      roomsPerUpgradeGrowth !== undefined &&
      Object.keys(trait.roomsPerUpgradeGrowth ?? {}).length !== 2
    )
      fail(
        `${path}.roomsPerUpgradeGrowth`,
        'requires only interval and maxManaByAcquisitionOrdinal',
      );
    if (roomsPerUpgradeGrowth !== undefined && trait.rarityDomain !== 'none')
      fail(`${path}.roomsPerUpgradeGrowth`, 'is declared only for rarityless traits');
    return Object.freeze({
      key: requireNonEmpty(trait.key, `${path}.key`),
      label: requireNonEmpty(trait.label, `${path}.label`),
      rarityDomain,
      eligibilityRequirements,
      linkedBoonRequirements,
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
      ...(trait.optionalLinkedPriority === undefined
        ? {}
        : {
            optionalLinkedPriority: requireBoolean(
              trait.optionalLinkedPriority,
              `${path}.optionalLinkedPriority`,
            ),
          }),
      isCoreGodTrait,
      blockStacking: requireBoolean(trait.blockStacking, `${path}.blockStacking`),
      blockOfferIfPreviouslyPicked:
        trait.blockOfferIfPreviouslyPicked === undefined
          ? false
          : requireBoolean(
              trait.blockOfferIfPreviouslyPicked,
              `${path}.blockOfferIfPreviouslyPicked`,
            ),
      blockInRunRarify: requireBoolean(trait.blockInRunRarify, `${path}.blockInRunRarify`),
      ...(trait.nonFinalBossRarityBlock === undefined
        ? {}
        : requireBoolean(trait.nonFinalBossRarityBlock, `${path}.nonFinalBossRarityBlock`)
          ? { nonFinalBossRarityBlock: true as const }
          : fail(`${path}.nonFinalBossRarityBlock`, 'must be true when declared')),
      excludeFromRarityCount: requireBoolean(
        trait.excludeFromRarityCount,
        `${path}.excludeFromRarityCount`,
      ),
      ...(activationRequirement === undefined ? {} : { activationRequirement }),
      ...(elementalMultiplier === undefined ? {} : { elementalMultiplier }),
      ...(rarityFloorEffect === undefined ? {} : { rarityFloorEffect }),
      ...(targetedAcquisition === undefined ? {} : { targetedAcquisition }),
      ...(maximumEligibleLevelByRarity === undefined ? {} : { maximumEligibleLevelByRarity }),
      ...(trait.selfExclusion === undefined
        ? {}
        : { selfExclusion: requireNonEmpty(trait.selfExclusion, `${path}.selfExclusion`) }),
      ...(hammerCompatibility === undefined ? {} : { hammerCompatibility }),
      ...(resourceRewardBonus === undefined ? {} : { resourceRewardBonus }),
      ...(roomsPerUpgradeGrowth === undefined ? {} : { roomsPerUpgradeGrowth }),
      ...(trait.acquisitionMaxHealthRoll === undefined
        ? {}
        : {
            acquisitionMaxHealthRoll: normalizeAcquisitionMaxHealthRoll(
              trait.acquisitionMaxHealthRoll,
              equippedRarities,
              `${path}.acquisitionMaxHealthRoll`,
            ),
          }),
      ...(trait.maxStatEffect === undefined
        ? {}
        : {
            maxStatEffect: normalizeMaxStatEffect(
              trait.maxStatEffect,
              equippedRarities,
              elementalMultiplier,
              `${path}.maxStatEffect`,
            ),
          }),
      ...(trait.raisesAspectToPerfect === undefined
        ? {}
        : (trait.raisesAspectToPerfect as unknown) === true
          ? { raisesAspectToPerfect: true as const }
          : fail(`${path}.raisesAspectToPerfect`, 'must be true when declared')),
      selectedDisposition,
    });
  });
  const collection = createCollection(values, 'traits', (trait) => trait.key);
  for (const trait of collection.values) {
    const expected = BLOCK_OFFER_IF_PREVIOUSLY_PICKED_TRAITS.has(trait.key);
    if (trait.blockOfferIfPreviouslyPicked !== expected) {
      fail(
        `traits.${trait.key}.blockOfferIfPreviouslyPicked`,
        expected
          ? 'is required by the source declaration'
          : 'is reserved to Bridal Glow, Buried Treasure, and Cherished Heirloom',
      );
    }
  }
  // Re-run requirements now that exact included keys are known.
  for (const trait of collection.values) {
    trait.eligibilityRequirements.forEach((requirement, index) =>
      normalizeRequirement(
        requirement,
        collection,
        deferred,
        `traits.${trait.key}.eligibilityRequirements[${index}]`,
      ),
    );
    trait.linkedBoonRequirements.forEach((requirement, index) =>
      normalizeRequirement(
        requirement,
        collection,
        deferred,
        `traits.${trait.key}.linkedBoonRequirements[${index}]`,
      ),
    );
  }
  return collection;
}
