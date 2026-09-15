import type { Catalog, TraitRarity } from '../../../catalog-schema';
import type { EquippedTrait } from '../../../authored-project/traits/state';

export function bridalGlowAddedLevels(rarity: TraitRarity | undefined): number {
  switch (rarity) {
    case 'Common':
      return 1;
    case 'Rare':
      return 2;
    case 'Epic':
      return 3;
    case 'Heroic':
      return 4;
    default:
      throw new Error(
        `Bridal Glow requires a ranked source rarity, received ${rarity ?? 'missing'}`,
      );
  }
}

export function isLevelBearingTrait(catalog: Catalog, traitKey: string): boolean {
  const declaration = catalog.traits.byKey[traitKey];
  return (
    declaration?.isCoreGodTrait === true &&
    declaration.rarityDomain.kind === 'ranked' &&
    !declaration.blockStacking
  );
}
/** The sole supported Pom target predicate. */
export function isPomEligibleTrait(catalog: Catalog, traitKey: string): boolean {
  const declaration = catalog.traits.byKey[traitKey];
  return declaration?.isCoreGodTrait === true && isLevelBearingTrait(catalog, traitKey);
}

/**
 * Whether one additional in-run level or rarity mutation can still improve an
 * equipped trait. Most traits have no declared cap; the three cooldown-bound
 * Hephaestus traits provide the exact current-level boundary.
 *
 * Proper Upbringing deliberately does not consume this predicate: its source
 * path directly promotes every eligible Common trait to Rare.
 */
export function hasEffectiveInRunUpgrade(
  catalog: Catalog,
  traitKey: string,
  trait: Pick<EquippedTrait, 'rarity' | 'level'>,
): boolean {
  if (trait.rarity === undefined || trait.level === undefined) return true;
  if (
    trait.rarity !== 'Common' &&
    trait.rarity !== 'Rare' &&
    trait.rarity !== 'Epic' &&
    trait.rarity !== 'Heroic'
  )
    return true;
  const maximum = catalog.traits.byKey[traitKey]?.maximumEligibleLevelByRarity?.[trait.rarity];
  return maximum === undefined || trait.level <= maximum;
}

/** The full current-frontier domain shared by Poms and Natural Selection. */
export function isPomUpgradeTarget(
  catalog: Catalog,
  trait: EquippedTrait | undefined,
): trait is EquippedTrait & { readonly level: number } {
  return (
    trait !== undefined &&
    trait.level !== undefined &&
    isPomEligibleTrait(catalog, trait.traitKey) &&
    hasEffectiveInRunUpgrade(catalog, trait.traitKey, trait)
  );
}

/** Computes the declaration-owned provider-index transform without consulting acquisition origin. */
export function nextRarity(
  catalog: Catalog,
  traitKey: string,
  rarity: TraitRarity,
): TraitRarity | undefined {
  const declaration = catalog.traits.byKey[traitKey];
  if (declaration?.rarityDomain.kind !== 'ranked') return undefined;
  const index = catalog.traitRarityOrder.indexOf(
    rarity as (typeof catalog.traitRarityOrder)[number],
  );
  const next = catalog.traitRarityOrder[index + 1];
  return next !== undefined && declaration.rarityDomain.equippedRarities.includes(next)
    ? next
    : undefined;
}
