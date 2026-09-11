import type {
  CatalogCollection,
  HammerCompatibility,
  ProperUpbringingEffect,
  TargetedTraitAcquisition,
  TraitDeclaration,
  TraitElement,
  TraitRarity,
  TraitRequirementExpression,
} from '@run-planner/engine/catalog-schema';

import type { RawTraitCatalogInput, RawTraitDeclaration } from '../declarations/traits';
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
import { normalizeRequirement, normalizeSelectedDisposition } from './trait-dispositions';

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
        selectedDisposition.slot !== icarusSlot)
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
    if (trait.key === 'SupplyDropBoon') {
      if (
        selectedDisposition.kind !== 'producePickups' ||
        selectedDisposition.producerLifecycleKey !== 'GeneratedTraitPickup' ||
        selectedDisposition.clock?.kind !== 'qualifyingEncounterEndEffects' ||
        selectedDisposition.clock.interval !== 7 ||
        selectedDisposition.pickups.length !== 2 ||
        selectedDisposition.pickups.some(
          (pickup, index) =>
            pickup.key !== `pom${index + 1}` || pickup.rewardType !== 'StoreRewardRandomStack',
        )
      )
        fail(
          `${path}.selectedDisposition`,
          'must declare the repeating seven-encounter two-Pom Supply Chain producer',
        );
    } else if (
      selectedDisposition.kind === 'producePickups' &&
      selectedDisposition.clock !== undefined
    ) {
      fail(`${path}.selectedDisposition.clock`, 'is reserved for Supply Chain');
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
      blockOfferIfPreviouslyPicked:
        trait.blockOfferIfPreviouslyPicked === undefined
          ? false
          : requireBoolean(
              trait.blockOfferIfPreviouslyPicked,
              `${path}.blockOfferIfPreviouslyPicked`,
            ),
      blockInRunRarify: requireBoolean(trait.blockInRunRarify, `${path}.blockInRunRarify`),
      excludeFromRarityCount: requireBoolean(
        trait.excludeFromRarityCount,
        `${path}.excludeFromRarityCount`,
      ),
      ...(rarityFloorEffect === undefined ? {} : { rarityFloorEffect }),
      ...(targetedAcquisition === undefined ? {} : { targetedAcquisition }),
      ...(maximumEligibleLevelByRarity === undefined ? {} : { maximumEligibleLevelByRarity }),
      ...(trait.selfExclusion === undefined
        ? {}
        : { selfExclusion: requireNonEmpty(trait.selfExclusion, `${path}.selfExclusion`) }),
      ...(hammerCompatibility === undefined ? {} : { hammerCompatibility }),
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
