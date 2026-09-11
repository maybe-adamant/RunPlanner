import type {
  AspectDeclaration,
  CatalogCollection,
  TraitDeclaration,
  TraitGiverDeclaration,
  WeaponDeclaration,
} from '@run-planner/engine/catalog-schema';

import { fail } from '../errors';

export function validateDirectTraitSets(
  traits: CatalogCollection<TraitDeclaration>,
  givers: CatalogCollection<TraitGiverDeclaration>,
): void {
  for (const trait of traits.values) {
    if (trait.selectedDisposition.kind === 'directTraitSets') {
      const sets = trait.selectedDisposition.sets;
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

export function validateAspectTraitOfferLevelBonuses(input: {
  readonly aspects: CatalogCollection<AspectDeclaration>;
  readonly traits: CatalogCollection<TraitDeclaration>;
}): void {
  for (const aspect of input.aspects.values) {
    const effect = aspect.traitOfferLevelBonus;
    if (effect === undefined) continue;
    if (aspect.key !== 'LobImpulseAspect')
      fail(`aspects.${aspect.key}.traitOfferLevelBonus`, 'is reserved for LobImpulseAspect');
    if (effect.maximumBonus !== 5 || effect.upgradedMaximumBonus !== 8)
      fail(
        `aspects.${aspect.key}.traitOfferLevelBonus`,
        'must use maximumBonus 5 and upgradedMaximumBonus 8',
      );
    if (effect.upgradeTraitKey !== 'WeaponUpgradeBoon')
      fail(
        `aspects.${aspect.key}.traitOfferLevelBonus.upgradeTraitKey`,
        'must reference WeaponUpgradeBoon',
      );
    if (input.traits.byKey[effect.upgradeTraitKey] === undefined)
      fail(`aspects.${aspect.key}.traitOfferLevelBonus.upgradeTraitKey`, 'unknown trait');
  }
}

export function validateWeaponAspectClosure(input: {
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
}): void {
  for (const weapon of input.weapons.values) {
    for (const aspectKey of weapon.aspectKeys) {
      const aspect = input.aspects.byKey[aspectKey];
      if (aspect === undefined)
        fail(`weapons.${weapon.key}.aspectKeys`, `unknown aspect ${aspectKey}`);
      if (aspect.weaponKey !== weapon.key)
        fail(`weapons.${weapon.key}.aspectKeys`, `cross-weapon aspect ${aspectKey}`);
    }
  }
  const referencedAspectKeys = new Set(input.weapons.values.flatMap((weapon) => weapon.aspectKeys));
  for (const aspect of input.aspects.values) {
    if (!referencedAspectKeys.has(aspect.key))
      fail(`aspects.${aspect.key}`, 'is not declared by a weapon');
  }
}

export function validateHammerCompatibilityClosure(input: {
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly weapons: CatalogCollection<WeaponDeclaration>;
  readonly aspects: CatalogCollection<AspectDeclaration>;
}): void {
  for (const trait of input.traits.values) {
    const compatibility = trait.hammerCompatibility;
    if (compatibility === undefined) continue;
    if (input.weapons.byKey[compatibility.weaponKey] === undefined)
      fail(
        `traits.${trait.key}.hammerCompatibility.weaponKey`,
        `unknown weapon ${compatibility.weaponKey}`,
      );
    for (const aspectKey of compatibility.aspectKeys) {
      const aspect = input.aspects.byKey[aspectKey];
      if (aspect === undefined)
        fail(`traits.${trait.key}.hammerCompatibility.aspectKeys`, `unknown aspect ${aspectKey}`);
      if (aspect.weaponKey !== compatibility.weaponKey)
        fail(
          `traits.${trait.key}.hammerCompatibility.aspectKeys`,
          `cross-weapon aspect ${aspectKey}`,
        );
    }
  }
}

export function validateTraitCatalogClosure(input: {
  readonly traits: CatalogCollection<TraitDeclaration>;
  readonly givers: CatalogCollection<TraitGiverDeclaration>;
}): void {
  validateDirectTraitSets(input.traits, input.givers);
}
