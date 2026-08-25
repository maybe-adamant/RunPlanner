import type {
  AspectDeclaration,
  CatalogCollection,
  TraitDeclaration,
  TraitGiverDeclaration,
} from '@run-planner/engine/catalog-schema';

import { fail } from './errors';

export function validateDirectTraitSets(
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

export function validateTravelDeal(traits: CatalogCollection<TraitDeclaration>): void {
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

export function validateProperUpbringingAndDeferred(input: {
  readonly declaredDeferred: readonly string[];
  readonly traits: CatalogCollection<TraitDeclaration>;
}): void {
  if (input.traits.byKey.ElementalRarityUpgradeBoon?.rarityFloorEffect === undefined)
    fail(
      'traits.ElementalRarityUpgradeBoon.rarityFloorEffect',
      'must declare the Proper Upbringing effect',
    );
  for (const key of input.declaredDeferred) {
    if (input.traits.byKey[key] !== undefined) {
      fail('deferredTraitKeys', `${key} is also an included trait`);
    }
  }
}

export function validateRuntimeOfferFallbacks(input: {
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
}): void {
  for (const trait of input.traits.values) {
    const fallbacks = trait.runtimeOfferFallbackTraitKeys;
    if (fallbacks === undefined) continue;
    const giver = input.givers.values.find((candidate) => candidate.traitKeys.includes(trait.key));
    if (giver === undefined)
      fail(`traits.${trait.key}.runtimeOfferFallbackTraitKeys`, 'preferred trait has no giver');
    for (const fallbackKey of fallbacks) {
      const fallback = input.traits.byKey[fallbackKey];
      if (fallback === undefined || !giver.traitKeys.includes(fallbackKey))
        fail(
          `traits.${trait.key}.runtimeOfferFallbackTraitKeys`,
          'must remain within the same giver',
        );
      if (fallback.offerRequirements.length !== 0)
        fail(
          `traits.${trait.key}.runtimeOfferFallbackTraitKeys`,
          'fallback traits must be requirement-free',
        );
    }
  }
}

export function validateAspectStartingTraits(input: {
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
}): void {
  for (const aspect of input.aspects.values) {
    const starting = aspect.startingTrait;
    if (starting === undefined) continue;
    const giver = input.givers.byKey[starting.giverKey];
    if (giver === undefined)
      fail(`aspects.${aspect.key}.startingTrait.giverKey`, 'unknown trait giver');
    if (giver.providerKind !== 'spell')
      fail(`aspects.${aspect.key}.startingTrait.giverKey`, 'must identify a spell provider');
    if (input.traits.byKey[starting.traitKey] === undefined)
      fail(`aspects.${aspect.key}.startingTrait.traitKey`, 'unknown trait');
    if (input.traits.byKey[starting.traitKey]?.equipmentSlot !== 'Spell')
      fail(`aspects.${aspect.key}.startingTrait.traitKey`, 'must occupy the Spell equipment slot');
    if (giver.traitKeys.includes(starting.traitKey))
      fail(
        `aspects.${aspect.key}.startingTrait.traitKey`,
        'must not belong to the normal spell pool',
      );
  }
}

export function validateTraitCatalogClosure(input: {
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
}): void {
  validateDirectTraitSets(input.traits, input.givers);
  validateTravelDeal(input.traits);
}
