import { optionIndex } from '../../authored-project/traits/state';
import {
  acquisitionOrdinalValue,
  type Catalog,
  type FamiliarDeclaration,
} from '../../catalog-schema';
import type { TraitHistoryState } from './history/model';

type PickedTraits = Pick<TraitHistoryState, 'previouslyPickedTraitKeys'>;

/** The planner assumes a mature file: every Aspect at rank V, the native `Legendary` level. */
export const MATURE_ASPECT_RARITY = 'Legendary';
/** Premium Service's rank VI, native `Perfect` in `WeaponRarityUpgradeOrder`. */
export const PERFECT_ASPECT_RARITY = 'Perfect';

/** A picked trait (Premium Service) permanently raised the equipped aspect to Perfect. */
export function aspectIsPerfect(catalog: Catalog, history: PickedTraits): boolean {
  return history.previouslyPickedTraitKeys.some(
    (traitKey) => catalog.traits.byKey[traitKey]?.raisesAspectToPerfect === true,
  );
}

/**
 * The familiar stack multiplier from each picked Circe acquisition at its
 * biome ordinal, kept after removal; 1 without one.
 */
export function familiarStackMultiplier(
  catalog: Catalog,
  history: Pick<TraitHistoryState, 'events'>,
): number {
  let multiplier = 1;
  for (const event of history.events) {
    if (event.kind !== 'traitOffer' && event.kind !== 'concaveStoneSecondary') continue;
    const traitKey = event.options[optionIndex(event.selectedOptionKey)]?.traitKey;
    const effect =
      traitKey === undefined ? undefined : catalog.traits.byKey[traitKey]?.maxStatEffect;
    if (effect?.kind !== 'familiarStackMultiplier') continue;
    if (event.acquisitionOrdinal === undefined)
      throw new Error(`${traitKey} lacks its acquisition ordinal`);
    multiplier *= acquisitionOrdinalValue(effect.multiplier, event.acquisitionOrdinal);
  }
  return multiplier;
}

/** Native `GetFamiliarTraitStacks` of each upgraded trait on a mature save. */
export function matureFamiliarTraitStacks(familiar: FamiliarDeclaration): number {
  return familiar.matureTraitUpgradeCount + 1;
}
